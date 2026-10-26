<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Ta3meedInvestmentSmsParser;
use App\Support\Ta3meedInvestmentFunding;
use App\Support\Ta3meedSmsParser;
use App\Support\Ta3meedSmsProcessor;
use App\Support\Ta3meedWalletLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

final class SmsInvestmentController extends Controller
{
    private function owner(Request $request): int
    {
        $id = (int) $request->attributes->get('ahmed_user_id', 0);
        abort_unless($id > 0, 401);
        return $id;
    }

    private function message(int $owner, int $id, bool $lock = false): object
    {
        $query = DB::table('sms_archive_messages')->where('user_id', $owner)->where('id', $id);
        $row = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($row, 404);
        if ($row->analysis_status === 'dismissed' && $row->action_type === 'investment') return $row;
        abort_unless(Ta3meedSmsParser::allowedSender(Crypt::decryptString($row->sender))
            && Ta3meedInvestmentSmsParser::recognizes(Crypt::decryptString($row->body))
            && ! $row->receipt_id && (! $row->wallet_entry_id || ($row->analysis_status === 'investment_funded' && $row->action_type === 'investment')), 422, 'هذه الرسالة ليست قبول استثمار يحتاج إكمالًا.');
        return $row;
    }

    private function version(object $row): string
    {
        return hash('sha256', json_encode([$row->id, $row->analysis_status, $row->analysis_reason, $row->updated_at, $row->investment_opportunity_id, $row->wallet_entry_id, $row->body]));
    }

    private function pending(object $row): bool
    {
        return in_array($row->analysis_status, ['pending', 'archived', 'non_payment', 'needs_review'], true);
    }

    public function show(Request $request, int $id)
    {
        $row = $this->message($this->owner($request), $id);
        abort_unless($this->pending($row) || in_array($row->analysis_status, ['investment_created', 'investment_funded'], true), 409, 'حُسمت هذه الرسالة؛ حدّث القائمة.');
        return response()->json(['version' => $this->version($row), 'suggestion' => Ta3meedInvestmentSmsParser::suggestion($row)])
            ->header('Cache-Control', 'no-store, private');
    }

    public function complete(Request $request, int $id)
    {
        $owner = $this->owner($request);
        $validated = $request->validate([
            'version' => ['required', 'regex:/^[a-f0-9]{64}$/D'],
            'code' => ['required', 'string', 'max:100'],
            'total_amount' => ['required', 'regex:/^\d{1,10}(?:\.\d{1,2})?$/D', 'numeric', 'min:0.01'],
            'start_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:'.now('Asia/Riyadh')->toDateString()],
            'profit' => ['required', 'regex:/^\d{1,10}(?:\.\d{1,2})?$/D', 'numeric', 'min:0'],
            'category' => ['required', 'in:A+,A,A-,B+,B,B-,C+,C,C-'],
            'months' => ['required', 'integer', 'min:1'],
            'maturity_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);
        $decision = $request->only(['code', 'total_amount', 'profit', 'profit_rate', 'category', 'months', 'start_date', 'withdrawal_date', 'maturity_date', 'notes', 'allocations']);
        ksort($decision);
        $hash = hash_hmac('sha256', json_encode($decision, JSON_THROW_ON_ERROR), (string) config('app.key'));
        $result = DB::transaction(function () use ($request, $owner, $id, $validated, $hash) {
            DB::table('users')->where('id', $owner)->lockForUpdate()->first();
            $row = $this->message($owner, $id, true);
            if (in_array($row->analysis_status, ['investment_created', 'investment_funded'], true)) {
                abort_unless(hash_equals((string) $row->investment_decision_hash, $hash), 409, 'سبق إكمال الرسالة ببيانات أخرى.');
                return ['data' => ['id' => $row->investment_opportunity_id], 'analysis' => Ta3meedSmsProcessor::outcome($row), 'replayed' => true];
            }
            abort_unless($this->pending($row) && hash_equals($this->version($row), $validated['version']), 409, 'حُسمت الرسالة أو تغيرت؛ حدّث القائمة.');
            // Reuse the existing opportunity writer and investor-allocation protections.
            // Its nested transaction and this decision commit or roll back together.
            $created = app(Ta3meedController::class)->store($request)->getData(true);
            $opportunity = $created['data'];
            DB::table('sms_archive_messages')->where('id', $row->id)->update([
                'analysis_status' => 'investment_created', 'analysis_reason' => 'investment_completed', 'action_type' => 'investment',
                'investment_opportunity_id' => $opportunity['id'], 'investment_decision_hash' => $hash,
                'payment_reference' => $opportunity['reference_number'], 'payment_amount' => $opportunity['principal_amount'],
                'analyzed_at' => now(), 'updated_at' => now(),
            ]);
            return ['data' => $opportunity, 'analysis' => Ta3meedSmsProcessor::outcome(DB::table('sms_archive_messages')->where('id', $row->id)->first()), 'replayed' => false];
        });
        return response()->json($result)->header('Cache-Control', 'no-store, private');
    }

    public function uploaded(Request $request, int $id)
    {
        $owner = $this->owner($request);
        $data = $request->validate(['version' => ['required', 'regex:/^[a-f0-9]{64}$/D']]);
        $result = DB::transaction(function () use ($owner, $id, $data) {
            DB::table('users')->where('id', $owner)->lockForUpdate()->first();
            $row = $this->message($owner, $id, true);
            if ($row->analysis_status === 'investment_funded') {
                $entry = DB::table('ta3meed_wallet_entries')->where('user_id', $owner)->where('id', $row->wallet_entry_id)
                    ->where('investment_opportunity_id', $row->investment_opportunity_id)->whereNull('voided_at')->first();
                abort_unless($entry && $entry->kind === 'withdrawal' && (int) $entry->amount_cents < 0, 409, 'حركة تمويل الفرصة تحتاج مراجعة.');
                return ['analysis' => Ta3meedSmsProcessor::outcome($row), 'summary' => Ta3meedWalletLedger::summary($owner), 'replayed' => true];
            }
            abort_unless(($this->pending($row) || $row->analysis_status === 'investment_created') && hash_equals($this->version($row), $data['version']), 409, 'حُسمت الرسالة أو تغيرت؛ حدّث القائمة.');
            $funded = Ta3meedInvestmentFunding::record($row);
            DB::table('sms_archive_messages')->where('id', $id)->update([
                'analysis_status' => 'investment_funded', 'analysis_reason' => $funded['replayed'] ? 'investment_previously_funded' : 'investment_uploaded',
                'action_type' => 'investment', 'investment_opportunity_id' => $funded['opportunity_id'], 'wallet_entry_id' => $funded['wallet_entry_id'],
                'payment_reference' => $funded['reference'], 'payment_amount' => $funded['amount'], 'analyzed_at' => now(), 'updated_at' => now(),
            ]);
            return ['analysis' => Ta3meedSmsProcessor::outcome(DB::table('sms_archive_messages')->where('id', $id)->first()),
                'summary' => Ta3meedWalletLedger::summary($owner), 'replayed' => $funded['replayed']];
        });
        return response()->json($result)->header('Cache-Control', 'no-store, private');
    }

    public function dismiss(Request $request, int $id)
    {
        $owner = $this->owner($request);
        $data = $request->validate(['version' => ['required', 'regex:/^[a-f0-9]{64}$/D']]);
        DB::transaction(function () use ($owner, $id, $data) {
            DB::table('users')->where('id', $owner)->lockForUpdate()->first();
            $row = $this->message($owner, $id, true);
            if ($row->analysis_status === 'dismissed') return;
            abort_unless($this->pending($row) && hash_equals($this->version($row), $data['version']), 409, 'سبق إكمال الرسالة أو تغيرت؛ حدّث القائمة.');
            // Erase content. Only delivery IDs/state remain to prevent a delayed queue retry from recreating it.
            DB::table('sms_archive_messages')->where('id', $id)->update([
                'analysis_status' => 'dismissed', 'analysis_reason' => 'investment_dismissed', 'action_type' => 'investment',
                'sender' => Crypt::encryptString(''), 'sender_hash' => hash_hmac('sha256', '', (string) config('app.key')),
                'body' => Crypt::encryptString(''), 'payment_reference' => null, 'payment_amount' => null,
                'payment_fingerprint' => null, 'received_at_ms' => 0, 'sent_at_ms' => null, 'subscription_id' => null, 'sim_slot' => null,
                'investment_opportunity_id' => null, 'investment_decision_hash' => null, 'analyzed_at' => now(), 'updated_at' => now(),
            ]);
        });
        return response()->json(['dismissed' => true, 'message_id' => $id])->header('Cache-Control', 'no-store, private');
    }
}
