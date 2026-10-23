<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Ta3meedAllocationPolicy as Policy;
use App\Support\Ta3meedInvestorName;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class Ta3meedInvestorRegistryController extends Controller
{
    public function index(Request $request)
    {
        $userId = Policy::userId($request);
        $items = DB::table('investment_investors')->where('user_id', $userId)->orderByDesc('is_active')->orderBy('id')->get();
        $counts = DB::table('investment_opportunity_allocations')->where('user_id', $userId)->selectRaw('investor_id, count(*) as opportunity_count')->groupBy('investor_id')->pluck('opportunity_count', 'investor_id');
        foreach ($items as $item) $item->opportunity_count = (int) ($counts[$item->id] ?? 0);
        return response()->json(['data' => $items]);
    }

    public function store(Request $request)
    {
        $userId = Policy::userId($request);
        $data = $request->validate(['name' => ['required', 'string', 'max:100']]);
        $item = DB::transaction(function () use ($data, $userId) {
            $name = trim($data['name']);
            $this->uniqueName($name, $userId);
            $id = DB::table('investment_investors')->insertGetId([
                'name' => $name, 'code' => 'investor-' . Str::uuid(), 'is_active' => true, 'user_id' => $userId,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $item = DB::table('investment_investors')->where('id', $id)->where('user_id', $userId)->first();
            Policy::audit($userId, 'investor_created', $id, null, null, null, $item);
            return $item;
        });
        return response()->json(['data' => $item], 201);
    }

    public function update(Request $request, int $id)
    {
        $userId = Policy::userId($request);
        $data = $request->validate(['name' => ['sometimes', 'required', 'string', 'max:100'], 'is_active' => ['sometimes', 'required', 'boolean']]);
        $item = DB::transaction(function () use ($data, $userId, $id) {
            $before = DB::table('investment_investors')->where('id', $id)->where('user_id', $userId)->lockForUpdate()->first();
            abort_unless($before, 404, 'المستثمر غير موجود في حسابك.');
            $values = [];
            if (array_key_exists('name', $data)) {
                $name = trim($data['name']);
                $this->uniqueName($name, $userId, $id);
                if ($name !== $before->name) $values['name'] = $name;
            }
            if (array_key_exists('is_active', $data) && (bool) $data['is_active'] !== (bool) $before->is_active) $values['is_active'] = $data['is_active'];
            if ($values) {
                DB::table('investment_investors')->where('id', $id)->where('user_id', $userId)->update($values + ['updated_at' => now()]);
                $after = DB::table('investment_investors')->where('id', $id)->first();
                Policy::audit($userId, 'investor_updated', $id, null, null, $before, $after);
                return $after;
            }
            return $before;
        });
        return response()->json(['data' => $item]);
    }

    private function uniqueName(string $name, int $userId, ?int $exceptId = null): void
    {
        $key = Ta3meedInvestorName::key($name);
        if ($key === '') Policy::fail('name', 'أدخل اسم المستثمر.');
        foreach (DB::table('investment_investors')->where('user_id', $userId)->get(['id', 'name', 'code']) as $item) {
            if ($item->id !== $exceptId && (Ta3meedInvestorName::key($item->name) === $key || Ta3meedInvestorName::key($item->code) === $key)) {
                Policy::fail('name', 'يوجد مستثمر مسجل بهذا الاسم. اختره من القائمة أو استخدم اسماً يميز المستثمر الآخر.');
            }
        }
    }

    public function preview(Request $request, int $id)
    {
        $userId = Policy::userId($request);
        $data = $this->changeData($request);
        return response()->json(['data' => $this->prepareChange($id, $data, $userId)]);
    }

    public function changeOwner(Request $request, int $id)
    {
        $userId = Policy::userId($request);
        $data = $this->changeData($request);
        $request->validate(['preview_token' => ['required', 'string'], 'confirmed' => ['required', 'accepted']]);
        $result = DB::transaction(function () use ($request, $id, $data, $userId) {
            $preview = $this->prepareChange($id, $data, $userId, true);
            abort_unless(hash_equals($preview['preview_token'], $request->input('preview_token')), 409, 'تغيرت بيانات الحصة أو مراجعة التعديل. اعرض المعاينة مجدداً.');
            $before = ['allocation' => $preview['allocation'], 'receipt_shares' => $preview['receipt_shares'], 'owner' => $preview['from_investor']];
            DB::table('investment_opportunity_allocations')->where('id', $id)->where('user_id', $userId)->update(['investor_id' => $data['investor_id'], 'updated_at' => now()]);
            if ($data['mode'] === 'correction') {
                DB::table('ta3meed_receipt_allocations')->where('allocation_id', $id)->where('opportunity_id', $preview['opportunity_id'])->where('user_id', $userId)->update(['investor_id' => $data['investor_id']]);
            }
            $afterAllocation = DB::table('investment_opportunity_allocations')->where('id', $id)->where('user_id', $userId)->first();
            $afterShares = DB::table('ta3meed_receipt_allocations')->where('allocation_id', $id)->where('user_id', $userId)->orderBy('id')->get();
            $after = ['allocation' => $afterAllocation, 'receipt_shares' => $afterShares, 'owner' => $preview['to_investor']];
            Policy::audit($userId, $data['mode'] === 'correction' ? 'allocation_owner_corrected' : 'unpaid_allocation_transferred', $data['investor_id'], $preview['opportunity_id'], $id, $before, $after, $data['reason']);
            return ['allocation_id' => $id, 'opportunity_id' => $preview['opportunity_id'], 'investor_id' => $data['investor_id'], 'recorded' => true];
        });
        return response()->json(['data' => $result]);
    }

    private function changeData(Request $request): array
    {
        $data = $request->validate([
            'investor_id' => ['required', 'integer', 'min:1'],
            'mode' => ['required', 'in:correction,transfer'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
            'allocation_version' => ['required', 'string', 'size:64'],
        ]);
        $data['reason'] = trim($data['reason']);
        if (mb_strlen($data['reason']) < 5) Policy::fail('reason', 'اكتب سبباً واضحاً للتصحيح أو نقل الحصة.');
        return $data;
    }

    private function prepareChange(int $id, array $data, int $userId, bool $lock = false): array
    {
        $query = DB::table('investment_opportunity_allocations')->where('id', $id)->where('user_id', $userId);
        if ($lock) $query->lockForUpdate();
        $allocation = $query->first();
        abort_unless($allocation, 404, 'الحصة غير موجودة في حسابك.');
        $platformId = DB::table('investment_platforms')->where('code', 'ta3meed')->value('id');
        $query = DB::table('investment_opportunities')->where('id', $allocation->opportunity_id)->where('user_id', $userId)->where('platform_id', $platformId);
        if ($lock) $query->lockForUpdate();
        $opportunity = $query->first();
        abort_unless($opportunity, 404);
        abort_if(in_array(strtolower($opportunity->status), ['cancelled', 'canceled'], true), 422, 'لا يمكن تعديل حقوق فرصة ملغاة.');
        Policy::load($opportunity, $userId);
        Policy::checkVersion($opportunity, $data['allocation_version']);
        if ($data['mode'] === 'transfer' && $opportunity->allocations_locked) {
            Policy::fail('mode', 'نقل الملكية متاح للحصة قبل بدء السداد. بعد تسجيل دفعات تبقى الحقوق والسداد محفوظة لصاحبها؛ استخدم تصحيح التسجيل فقط عند وجود خطأ فعلي في اسم المالك.');
        }
        $from = DB::table('investment_investors')->where('id', $allocation->investor_id)->where('user_id', $userId)->first();
        $to = DB::table('investment_investors')->where('id', $data['investor_id'])->where('user_id', $userId)->where('is_active', true)->first();
        if (! $to) Policy::fail('investor_id', 'اختر مستثمراً نشطاً من حسابك.');
        if ($allocation->investor_id === $to->id) Policy::fail('investor_id', 'اختر مستثمراً مختلفاً عن صاحب الحصة الحالي.');
        if (DB::table('investment_opportunity_allocations')->where('opportunity_id', $opportunity->id)->where('user_id', $userId)->where('investor_id', $to->id)->exists()) {
            Policy::fail('investor_id', 'المستثمر المختار يملك حصة في هذه الفرصة بالفعل. لا يتم دمج الحقوق تلقائياً.');
        }
        $shares = DB::table('ta3meed_receipt_allocations')->where('allocation_id', $id)->where('user_id', $userId)->orderBy('id')->get();
        if ($shares->contains(fn ($share) => $share->opportunity_id !== $opportunity->id || $share->investor_id !== $allocation->investor_id)) {
            abort(409, 'توجد دفعة بحاجة إلى مطابقة قبل تعديل صاحب الحصة.');
        }
        $snapshot = [
            'allocation' => (array) $allocation, 'receipt_shares' => $shares->map(fn ($s) => (array) $s)->all(),
            'opportunity_id' => $opportunity->id, 'reference_number' => $opportunity->reference_number,
            'from_investor' => ['id' => $from->id, 'name' => $from->name],
            'to_investor' => ['id' => $to->id, 'name' => $to->name],
            'mode' => $data['mode'], 'reason' => trim($data['reason']), 'allocation_version' => $opportunity->allocation_version,
            'principal_amount' => round((float) $allocation->invested_amount, 2),
            'expected_profit_amount' => round((float) $allocation->expected_profit_amount, 2),
            'received_amount' => round((float) $allocation->received_amount, 2),
            'receipt_count' => $shares->count(), 'allocation_id' => $id,
        ];
        $snapshot['preview_token'] = hash_hmac('sha256', json_encode($snapshot, JSON_UNESCAPED_UNICODE), (string) config('app.key'));
        return $snapshot;
    }

    public function history(Request $request, int $id)
    {
        $userId = Policy::userId($request);
        abort_unless(DB::table('investment_opportunities')->where('id', $id)->where('user_id', $userId)->exists(), 404);
        $rows = DB::table('ta3meed_investor_audits')->where('user_id', $userId)->where('opportunity_id', $id)->orderByDesc('id')->limit(100)->get();
        foreach ($rows as $row) {
            $row->before = json_decode($row->before_json, true);
            $row->after = json_decode($row->after_json, true);
            unset($row->before_json, $row->after_json);
        }
        return response()->json(['data' => $rows]);
    }
}
