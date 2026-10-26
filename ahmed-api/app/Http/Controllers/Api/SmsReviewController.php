<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Ta3meedAllocationPolicy;
use App\Support\Ta3meedSmsParser;
use App\Support\Ta3meedSmsProcessor;
use App\Support\Ta3meedSmsReviewData;
use App\Support\Ta3meedInvestmentSmsParser;
use App\Support\Ta3meedWalletLedger;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

final class SmsReviewController extends Controller
{
    private function owner(Request $request): int
    {
        $id = (int) $request->attributes->get('ahmed_user_id', 0);
        abort_unless($id > 0, 401);
        return $id;
    }

    private function message(int $userId, int $id, bool $lock = false): object
    {
        $query = DB::table('sms_archive_messages')->where('user_id', $userId)->where('id', $id);
        $row = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($row, 404);
        abort_unless(Ta3meedSmsParser::allowedSender(Crypt::decryptString($row->sender)), 422, 'الاعتماد متاح لرسائل Ta3meed فقط.');
        abort_if($row->action_type === 'investment' || Ta3meedInvestmentSmsParser::recognizes(Crypt::decryptString($row->body)), 422, 'هذه رسالة قبول استثمار؛ استخدم إكمال الفرصة أو إلغاء.');
        return $row;
    }

    private function version(object $row): string
    {
        return hash('sha256', json_encode([$row->id, $row->analysis_status, $row->analysis_reason, $row->analyzed_at, $row->wallet_entry_id, $row->receipt_id]));
    }

    private function suggestion(object $row): array
    {
        $sent = (int) ($row->sent_at_ms ?? 0);
        $useSent = $sent >= 946684800000 && $sent <= (int) $row->received_at_ms + 600000;
        $date = CarbonImmutable::createFromTimestampMs($useSent ? $sent : (int) $row->received_at_ms, 'Asia/Riyadh')->toDateString();
        return Ta3meedSmsReviewData::extract(Crypt::decryptString($row->body), $date, $useSent ? 'sent_at' : 'received_at');
    }

    public function show(Request $request, int $id)
    {
        $row = $this->message($this->owner($request), $id);
        abort_unless($row->analysis_status === 'needs_review', 409, 'حالة الرسالة تغيرت؛ حدّث الرسائل.');
        return response()->json(['version' => $this->version($row)] + $this->suggestion($row))
            ->header('Cache-Control', 'no-store, private');
    }

    private function form(Request $request): array
    {
        $data = $request->validate([
            'version' => ['required', 'regex:/^[a-f0-9]{64}$/D'],
            'kind' => ['required', 'in:deposit,withdrawal,repayment'],
            'amount' => ['required', 'regex:/^\d{1,10}(?:\.\d{1,2})?$/D'],
            'entry_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:'.now('Asia/Riyadh')->toDateString()],
            'reference' => ['required_if:kind,repayment', 'nullable', 'string', 'max:100'],
            'receipt_type' => ['required_if:kind,repayment', 'nullable', 'in:partial,full,early_settlement'],
            'mode' => ['required', 'in:new,link'],
            'link_entry_id' => ['required_if:mode,link', 'nullable', 'integer', 'min:1'],
            'confirmed' => ['required', 'accepted'],
            'confirm_duplicate' => ['nullable', 'boolean'],
            'duplicate_token' => ['nullable', 'string', 'size:64'],
        ]);
        $data['amount_cents'] = Ta3meedAllocationPolicy::cents($data['amount']);
        abort_unless($data['amount_cents'] > 0, 422, 'أدخل مبلغًا أكبر من صفر.');
        $data['reference'] = strtoupper(trim(Ta3meedSmsParser::normalize($data['reference'] ?? '')));
        if ($data['kind'] === 'repayment') abort_unless(preg_match('/^(?:INV\s*-?\s*)?[A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*$/D', $data['reference']), 422, 'أدخل رقم فرصة تعميد الصحيح.');
        return $data;
    }

    private function canonical(array $data): array
    {
        return ['kind' => $data['kind'], 'amount_cents' => $data['amount_cents'], 'entry_date' => $data['entry_date'],
            'reference' => $data['reference'], 'receipt_type' => $data['kind'] === 'repayment' ? $data['receipt_type'] : null,
            'mode' => $data['mode'], 'link_entry_id' => $data['mode'] === 'link' ? (int) $data['link_entry_id'] : null];
    }

    private function cleanReference(string $reference): string
    {
        return preg_replace('/[^A-Z0-9]/', '', strtoupper($reference));
    }

    private function candidates(int $userId, array $data): array
    {
        $signed = ($data['kind'] === 'withdrawal' ? -1 : 1) * $data['amount_cents'];
        $rows = Ta3meedWalletLedger::active($userId)->where('e.kind', '!=', 'opening_balance')
            ->where(function ($query) use ($data, $signed) {
                $query->where(fn ($q) => $q->whereRaw('('.Ta3meedWalletLedger::amountSql().') = ?', [$signed])->whereRaw(Ta3meedWalletLedger::dateSql().' = ?', [$data['entry_date']]));
                if ($data['kind'] !== 'repayment' && $data['reference'] !== '') {
                    $query->orWhere(fn ($q) => $q->where('e.kind', $data['kind'])->where('e.transaction_reference', $data['reference']));
                }
            })->select('e.id', 'e.kind', 'e.source', 'e.revision', 'e.transaction_reference', 'e.receipt_id', 'r.reference_number as receipt_reference', 'r.receipt_type')
            ->selectRaw(Ta3meedWalletLedger::amountSql().' as effective_cents')->selectRaw(Ta3meedWalletLedger::dateSql().' as effective_date')
            ->orderByDesc('e.id')->limit(51)->get();
        // A truncated candidate set must never be usable as an override token.
        abort_if($rows->count() > 50, 422, 'توجد حركات كثيرة مشابهة؛ راجع سجل المحفظة وحدد بيانات العملية بدقة.');
        return $rows->map(function ($row) use ($data, $signed) {
            $same = (int) $row->effective_cents === $signed && substr($row->effective_date, 0, 10) === $data['entry_date'];
            $linkable = $same && ($data['kind'] === 'repayment'
                ? $row->kind === 'repayment' && $row->receipt_id && $this->cleanReference($row->receipt_reference ?? '') === $this->cleanReference($data['reference']) && $row->receipt_type === $data['receipt_type']
                : ($data['kind'] === 'deposit' ? in_array($row->kind, ['deposit', 'repayment'], true) : $row->kind === 'withdrawal'));
            return ['id' => (int) $row->id, 'kind' => $row->kind, 'source' => $row->source, 'amount_cents' => (int) $row->effective_cents,
                'entry_date' => substr($row->effective_date, 0, 10), 'reference' => $row->receipt_reference ?? $row->transaction_reference,
                'receipt_id' => $row->receipt_id, 'receipt_type' => $row->receipt_type, 'revision' => (int) $row->revision, 'linkable' => (bool) $linkable];
        })->all();
    }

    public function approve(Request $request, int $id)
    {
        $userId = $this->owner($request);
        $data = $this->form($request);
        $canonical = $this->canonical($data);
        $result = DB::transaction(function () use ($userId, $id, $data, $canonical) {
            // Same lock order as automatic SMS, wallet entries and receipt writers.
            DB::table('users')->where('id', $userId)->lockForUpdate()->first();
            $row = $this->message($userId, $id, true);
            $approved = DB::table('sms_review_approvals')->where('user_id', $userId)->where('message_id', $id)->first();
            if ($approved) {
                abort_unless(json_decode($approved->decision, true)['request'] === $canonical, 409, 'اعتُمدت هذه الرسالة ببيانات أخرى. حدّث الرسائل.');
                return ['analysis' => Ta3meedSmsProcessor::outcome($row), 'replayed' => true];
            }
            abort_unless($row->analysis_status === 'needs_review' && hash_equals($this->version($row), $data['version']), 409, 'حالة الرسالة تغيرت؛ حدّث الرسائل قبل الاعتماد.');
            $candidates = $this->candidates($userId, $data);
            $token = hash_hmac('sha256', json_encode([$id, $this->version($row), array_replace($canonical, ['mode' => 'new', 'link_entry_id' => null]), $candidates]), (string) config('app.key'));
            if ($data['mode'] === 'new' && $candidates && (empty($data['confirm_duplicate']) || ! hash_equals($token, $data['duplicate_token'] ?? ''))) {
                return ['conflict' => true, 'message' => 'توجد حركة مشابهة. اربط الرسالة بحركة مسجلة، أو أكد أنها عملية مستقلة.', 'candidates' => $candidates, 'duplicate_token' => $token];
            }
            $entryId = null; $receiptId = null;
            if ($data['mode'] === 'link') {
                $candidate = collect($candidates)->firstWhere('id', (int) $data['link_entry_id']);
                abort_unless($candidate && $candidate['linkable'], 409, 'الحركة المختارة لا تطابق البيانات أو تغيرت. راجع بيانات الرسالة.');
                $entryId = $candidate['id']; $receiptId = $candidate['receipt_id'];
                Ta3meedWalletLedger::audit($userId, $entryId, 'sms_linked');
            } elseif ($data['kind'] === 'repayment') {
                $result = app(Ta3meedReceiptController::class)->recordIncomingSms($userId, [
                    'reference_number' => $data['reference'], 'amount' => $data['amount_cents'] / 100, 'receipt_type' => $data['receipt_type'],
                ], Crypt::decryptString($row->body), $data['entry_date'], true);
                if ($result['status'] !== 'applied') {
                    return ['invalid' => true, 'message' => 'تعذر اعتماد السداد: راجع رقم الفرصة والمبلغ المتبقي ونوع السداد.', 'reason' => $result['reason'] ?? 'processing_failed'];
                }
                $receiptId = $result['receipt_id'];
                $entryId = DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('receipt_id', $receiptId)->value('id');
            } else {
                $body = Crypt::decryptString($row->body);
                $fingerprint = hash_hmac('sha256', 'wallet|'.$data['kind'].'|'.($data['reference'] !== '' ? 'ref:'.$data['reference'] : $data['entry_date'].'|'.mb_strtolower(Ta3meedSmsParser::normalize($body))), (string) config('app.key'));
                if (DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('fingerprint', $fingerprint)->exists()) {
                    $fingerprint = hash_hmac('sha256', 'reviewed-message|'.$id, (string) config('app.key'));
                }
                $entryId = DB::table('ta3meed_wallet_entries')->insertGetId(['user_id' => $userId, 'kind' => $data['kind'],
                    'amount_cents' => ($data['kind'] === 'withdrawal' ? -1 : 1) * $data['amount_cents'], 'entry_date' => $data['entry_date'],
                    'source' => 'sms', 'sms_message_id' => $id, 'fingerprint' => $fingerprint, 'transaction_reference' => $data['reference'] ?: null,
                    'notes' => 'رسالة Ta3meed معتمدة يدويًا', 'created_at' => now(), 'updated_at' => now()]);
                Ta3meedWalletLedger::audit($userId, $entryId, 'sms_approved');
            }
            abort_unless($entryId, 422, 'تعذر ربط العملية بسجل المحفظة.');
            DB::table('sms_review_approvals')->insert(['user_id' => $userId, 'message_id' => $id, 'wallet_entry_id' => $entryId, 'receipt_id' => $receiptId,
                'decision' => json_encode(['request' => $canonical, 'before_status' => $row->analysis_status, 'before_reason' => $row->analysis_reason,
                    'confirmed_duplicate' => $data['mode'] === 'new' && (bool) $candidates], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'created_at' => now()]);
            DB::table('sms_archive_messages')->where('id', $id)->update(['analysis_status' => $data['mode'] === 'link' ? 'duplicate' : 'applied',
                'analysis_reason' => $data['mode'] === 'link' ? 'manually_linked' : 'manually_approved', 'action_type' => $data['kind'],
                'payment_amount' => $data['amount_cents'] / 100, 'payment_reference' => $data['reference'] ?: null, 'wallet_entry_id' => $entryId,
                'receipt_id' => $receiptId, 'analyzed_at' => now(), 'updated_at' => now()]);
            return ['analysis' => Ta3meedSmsProcessor::outcome(DB::table('sms_archive_messages')->where('id', $id)->first()), 'replayed' => false];
        });
        if (! empty($result['conflict'])) return response()->json($result, 409)->header('Cache-Control', 'no-store, private');
        if (! empty($result['invalid'])) return response()->json($result, 422)->header('Cache-Control', 'no-store, private');
        // Success is returned only after receipt, allocations, wallet, audit and archive commit.
        return response()->json($result + ['summary' => Ta3meedWalletLedger::summary($userId)])
            ->header('Cache-Control', 'no-store, private');
    }
}
