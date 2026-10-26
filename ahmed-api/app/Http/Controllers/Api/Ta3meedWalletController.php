<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Ta3meedAllocationPolicy;
use App\Support\Ta3meedWalletLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class Ta3meedWalletController extends Controller
{
    private function owner(Request $request): int
    {
        $id = (int) $request->attributes->get('ahmed_user_id', 0);
        abort_unless($id > 0, 401);
        return $id;
    }

    public function index(Request $request)
    {
        $data = $request->validate(['page' => ['nullable', 'integer', 'min:1', 'max:10000'], 'kind' => ['nullable', 'in:opening_balance,deposit,withdrawal,repayment']]);
        $userId = $this->owner($request);
        $query = Ta3meedWalletLedger::active($userId);
        if (! empty($data['kind'])) $query->where('e.kind', $data['kind']);
        $total = (clone $query)->count();
        $page = (int) ($data['page'] ?? 1);
        $items = $query->select('e.*')->selectRaw(Ta3meedWalletLedger::amountSql().' as effective_cents')
            ->selectRaw(Ta3meedWalletLedger::dateSql().' as effective_date')
            ->orderByDesc('effective_date')->orderByDesc('e.id')->offset(($page - 1) * 50)->limit(50)->get()->map(fn ($row) => [
                'id' => $row->id, 'kind' => $row->kind, 'amount_cents' => (int) $row->effective_cents,
                'entry_date' => substr($row->effective_date, 0, 10), 'source' => $row->source, 'notes' => $row->notes,
                'transaction_reference' => $row->transaction_reference, 'receipt_id' => $row->receipt_id,
                'sms_message_id' => $row->sms_message_id, 'revision' => $row->revision, 'editable' => $row->source === 'manual',
                'investment_opportunity_id' => $row->investment_opportunity_id ?? null,
            ])->values();
        return response()->json(['data' => $items, 'summary' => Ta3meedWalletLedger::summary($userId),
            'total' => $total, 'page' => $page, 'has_more' => $page * 50 < $total])->header('Cache-Control', 'no-store, private');
    }

    private function form(Request $request, bool $updating): array
    {
        $data = $request->validate([
            'kind' => ['required', 'in:opening_balance,deposit,withdrawal'],
            'amount' => ['required', 'regex:/^\d{1,10}(?:\.\d{1,2})?$/D'],
            'entry_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:'.now('Asia/Riyadh')->toDateString()],
            'notes' => ['nullable', 'string', 'max:2000'],
            'transaction_reference' => ['nullable', 'string', 'max:100'],
            'request_id' => [$updating ? 'nullable' : 'required', 'uuid'],
            'expected_revision' => [$updating ? 'required' : 'nullable', 'integer', 'min:1'],
            'allow_duplicate' => ['nullable', 'boolean'],
        ]);
        $cents = Ta3meedAllocationPolicy::cents($data['amount']);
        abort_if($cents <= 0 && $data['kind'] !== 'opening_balance', 422, 'أدخل مبلغًا أكبر من صفر.');
        $data['amount_cents'] = $data['kind'] === 'withdrawal' ? -$cents : $cents;
        $data['transaction_reference'] = empty($data['transaction_reference']) ? null : mb_strtoupper(trim($data['transaction_reference']));
        return $data;
    }

    private function guard(int $userId, array $data, ?int $excluding = null): void
    {
        if ($data['kind'] === 'opening_balance') {
            $query = DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('kind', 'opening_balance')->whereNull('voided_at');
            if ($excluding) $query->where('id', '!=', $excluding);
            abort_if($query->exists(), 409, 'يوجد رصيد افتتاحي؛ عدّله من سجل الحركات.');
            return;
        }
        if (empty($data['allow_duplicate']) && Ta3meedWalletLedger::possibleDuplicate($userId, $data['amount_cents'], $data['entry_date'], $data['transaction_reference'], $excluding)) {
            abort(409, 'توجد حركة بالقيمة والتاريخ نفسيهما. راجع السجل أو اختر إضافتها كحركة مستقلة.');
        }
    }

    public function store(Request $request)
    {
        $userId = $this->owner($request); $data = $this->form($request, false);
        $id = DB::transaction(function () use ($userId, $data) {
            DB::table('users')->where('id', $userId)->lockForUpdate()->first();
            $existing = DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('request_id', $data['request_id'])->first();
            if ($existing) {
                abort_if($existing->voided_at !== null, 409, 'حُذفت هذه الحركة سابقًا. حدّث سجل المحفظة.');
                abort_unless($existing->kind === $data['kind'] && (int) $existing->amount_cents === $data['amount_cents']
                    && substr($existing->entry_date, 0, 10) === $data['entry_date']
                    && (string) $existing->notes === (string) ($data['notes'] ?? '')
                    && $existing->transaction_reference === $data['transaction_reference'], 409, 'هذا الطلب محفوظ ببيانات أخرى. أعد فتح نموذج الإضافة.');
                return $existing->id;
            }
            $this->guard($userId, $data);
            $id = DB::table('ta3meed_wallet_entries')->insertGetId(['user_id' => $userId, 'kind' => $data['kind'],
                'amount_cents' => $data['amount_cents'], 'entry_date' => $data['entry_date'], 'source' => 'manual', 'request_id' => $data['request_id'],
                'transaction_reference' => $data['transaction_reference'], 'notes' => $data['notes'] ?? null, 'created_at' => now(), 'updated_at' => now()]);
            Ta3meedWalletLedger::audit($userId, $id, 'created');
            return $id;
        });
        return response()->json(['id' => $id, 'summary' => Ta3meedWalletLedger::summary($userId)])->header('Cache-Control', 'no-store, private');
    }

    public function update(Request $request, int $id)
    {
        $userId = $this->owner($request); $data = $this->form($request, true);
        DB::transaction(function () use ($userId, $id, $data) {
            DB::table('users')->where('id', $userId)->lockForUpdate()->first();
            $row = DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('id', $id)->whereNull('voided_at')->lockForUpdate()->first();
            abort_unless($row, 404); abort_unless($row->source === 'manual', 422, 'هذه حركة تلقائية مرتبطة بمصدرها.');
            abort_unless((int) $row->revision === (int) $data['expected_revision'], 409, 'تغيرت الحركة؛ حدّث السجل قبل التعديل.');
            $this->guard($userId, $data, $id);
            DB::table('ta3meed_wallet_entries')->where('id', $id)->update(['kind' => $data['kind'], 'amount_cents' => $data['amount_cents'],
                'entry_date' => $data['entry_date'], 'notes' => $data['notes'] ?? null, 'transaction_reference' => $data['transaction_reference'],
                'revision' => $row->revision + 1, 'updated_at' => now()]);
            Ta3meedWalletLedger::audit($userId, $id, 'updated');
        });
        return response()->json(['summary' => Ta3meedWalletLedger::summary($userId)]);
    }

    public function destroy(Request $request, int $id)
    {
        $userId = $this->owner($request);
        $data = $request->validate(['expected_revision' => ['required', 'integer', 'min:1']]);
        DB::transaction(function () use ($userId, $id, $data) {
            DB::table('users')->where('id', $userId)->lockForUpdate()->first();
            $row = DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('id', $id)->whereNull('voided_at')->lockForUpdate()->first();
            abort_unless($row, 404); abort_unless($row->source === 'manual', 422, 'هذه حركة تلقائية مرتبطة بمصدرها.');
            abort_unless((int) $row->revision === (int) $data['expected_revision'], 409, 'تغيرت الحركة؛ حدّث السجل قبل الحذف.');
            DB::table('ta3meed_wallet_entries')->where('id', $id)->update(['voided_at' => now(), 'revision' => $row->revision + 1, 'updated_at' => now()]);
            Ta3meedWalletLedger::audit($userId, $id, 'voided');
        });
        return response()->json(['summary' => Ta3meedWalletLedger::summary($userId)]);
    }
}
