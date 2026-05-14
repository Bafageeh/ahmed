<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MoneyMoonTenantController extends Controller
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $platform = $this->platform();
        if (! $platform) return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        $query = DB::table('investment_opportunities')->where('platform_id', $platform->id);
        $this->scopeUser($query, 'investment_opportunities', $userId);
        return response()->json(['data' => $query->orderByDesc('id')->get()]);
    }

    public function store(Request $request)
    {
        $userId = $this->userId($request);
        $data = $this->validatedData($request);
        $platform = $this->platform();
        if (! $platform) return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        $orderNo = $this->normalizeOrderNo($data['order_no'] ?? null);
        if ($orderNo && $this->findByOrderNo($platform->id, $orderNo, null, $userId)) return response()->json(['message' => 'رقم الطلب موجود مسبقًا في موني مون'], 422);
        $accountId = $this->accountId($platform->id, $userId);
        $dates = $this->investmentDates($data);
        $rate = $this->profitRate($data['category']);
        $profit = round(((float) $data['amount']) * ($rate / 100), 2);
        $insert = [
            'account_id' => $accountId,
            'platform_id' => $platform->id,
            'title' => $orderNo ? 'MoneyMoon ' . $orderNo : 'MoneyMoon ' . $data['category'],
            'investment_type' => 'moneymoon',
            'principal_amount' => $data['amount'],
            'expected_profit_amount' => $profit,
            'actual_profit_amount' => 0,
            'expected_rate' => $rate,
            'start_date' => $dates['investment_date'],
            'maturity_date' => $dates['maturity_date'],
            'status' => 'active',
            'profit_distribution' => 'at_maturity',
            'metadata' => json_encode($this->metadata($data, $rate, $orderNo), JSON_UNESCAPED_UNICODE),
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ];
        $this->attachUser($insert, 'investment_opportunities', $userId);
        $id = DB::table('investment_opportunities')->insertGetId($insert);
        return response()->json(['data' => DB::table('investment_opportunities')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $data = $this->validatedData($request);
        $platform = $this->platform();
        if (! $platform) return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        $query = DB::table('investment_opportunities')->where('id', $id)->where('platform_id', $platform->id);
        $this->scopeUser($query, 'investment_opportunities', $userId);
        if (! $query->first()) return response()->json(['message' => 'Investment not found'], 404);
        $orderNo = $this->normalizeOrderNo($data['order_no'] ?? null);
        if ($orderNo && $this->findByOrderNo($platform->id, $orderNo, $id, $userId)) return response()->json(['message' => 'رقم الطلب موجود مسبقًا في موني مون'], 422);
        $dates = $this->investmentDates($data);
        $rate = $this->profitRate($data['category']);
        DB::table('investment_opportunities')->where('id', $id)->update([
            'title' => $orderNo ? 'MoneyMoon ' . $orderNo : 'MoneyMoon ' . $data['category'],
            'principal_amount' => $data['amount'],
            'expected_profit_amount' => round(((float) $data['amount']) * ($rate / 100), 2),
            'expected_rate' => $rate,
            'start_date' => $dates['investment_date'],
            'maturity_date' => $dates['maturity_date'],
            'metadata' => json_encode($this->metadata($data, $rate, $orderNo), JSON_UNESCAPED_UNICODE),
            'notes' => $data['notes'] ?? null,
            'updated_at' => now(),
        ]);
        return response()->json(['data' => DB::table('investment_opportunities')->where('id', $id)->first()]);
    }

    public function destroy(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $platform = $this->platform();
        if (! $platform) return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        $query = DB::table('investment_opportunities')->where('id', $id)->where('platform_id', $platform->id);
        $this->scopeUser($query, 'investment_opportunities', $userId);
        if (! $query->first()) return response()->json(['message' => 'Investment not found'], 404);
        DB::table('investment_opportunities')->where('id', $id)->delete();
        return response()->json(['ok' => true, 'deleted_id' => $id]);
    }

    public function receive(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $platform = $this->platform();
        if (! $platform) return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        $query = DB::table('investment_opportunities')->where('id', $id)->where('platform_id', $platform->id);
        $this->scopeUser($query, 'investment_opportunities', $userId);
        $investment = $query->first();
        if (! $investment) return response()->json(['message' => 'Investment not found'], 404);
        DB::table('investment_opportunities')->where('id', $id)->update([
            'status' => 'received',
            'actual_profit_amount' => $investment->expected_profit_amount,
            'completed_at' => now()->toDateString(),
            'updated_at' => now(),
        ]);
        return response()->json(['data' => DB::table('investment_opportunities')->where('id', $id)->first()]);
    }

    private function platform()
    {
        return DB::table('investment_platforms')->where('code', 'moneymoon')->first();
    }

    private function accountId(int $platformId, int $userId): int
    {
        $query = DB::table('investment_accounts')->where('platform_id', $platformId);
        $this->scopeUser($query, 'investment_accounts', $userId);
        $id = $query->value('id');
        if ($id) return (int) $id;
        $insert = ['platform_id' => $platformId, 'display_name' => 'MoneyMoon Wallet', 'currency' => 'SAR', 'wallet_balance' => 0, 'total_invested_snapshot' => 0, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()];
        $this->attachUser($insert, 'investment_accounts', $userId);
        return DB::table('investment_accounts')->insertGetId($insert);
    }

    private function validatedData(Request $request): array
    {
        return $request->validate(['amount' => ['required', 'numeric', 'min:0.01'], 'category' => ['required', 'in:A,B,C,D'], 'investment_date' => ['required', 'date'], 'maturity_date' => ['nullable', 'date'], 'order_no' => ['nullable', 'string', 'max:80'], 'notes' => ['nullable', 'string']]);
    }

    private function investmentDates(array $data): array
    {
        $investmentDate = Carbon::parse($data['investment_date']);
        $maturityDate = ! empty($data['maturity_date']) ? Carbon::parse($data['maturity_date']) : $investmentDate->copy()->addMonthNoOverflow();
        return ['investment_date' => $investmentDate->toDateString(), 'maturity_date' => $maturityDate->toDateString()];
    }

    private function profitRate(string $category): float
    {
        return ['A' => 2, 'B' => 2, 'C' => 3, 'D' => 4][$category] ?? 0;
    }

    private function metadata(array $data, float $rate, ?string $orderNo): array
    {
        $meta = ['category' => $data['category'], 'profit_rate' => $rate, 'manual_maturity' => ! empty($data['maturity_date'])];
        if ($orderNo) $meta['order_no'] = $orderNo;
        if ($orderNo) $meta['external_order_no'] = $orderNo;
        return $meta;
    }

    private function normalizeOrderNo(?string $orderNo): ?string
    {
        $orderNo = trim((string) $orderNo);
        return $orderNo === '' ? null : $orderNo;
    }

    private function findByOrderNo(int $platformId, string $orderNo, ?int $exceptId, int $userId)
    {
        $query = DB::table('investment_opportunities')->where('platform_id', $platformId)->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId));
        $this->scopeUser($query, 'investment_opportunities', $userId);
        foreach ($query->get(['id', 'metadata']) as $investment) {
            $meta = json_decode((string) $investment->metadata, true);
            $current = is_array($meta) ? ($meta['external_order_no'] ?? $meta['order_no'] ?? null) : null;
            if ($current && strcasecmp((string) $current, $orderNo) === 0) return $investment;
        }
        return null;
    }

    private function userId(Request $request): int
    {
        $id = (int) $request->header('X-Ahmed-User-Id', 0);
        if ($id > 0 && Schema::hasTable('users') && DB::table('users')->where('id', $id)->exists()) return $id;
        return Schema::hasTable('users') ? (int) (DB::table('users')->orderBy('id')->value('id') ?: 1) : 1;
    }

    private function scopeUser($query, string $table, int $userId): void
    {
        if (Schema::hasColumn($table, 'user_id')) $query->where($table . '.user_id', $userId);
    }

    private function attachUser(array &$data, string $table, int $userId): void
    {
        if (Schema::hasColumn($table, 'user_id')) $data['user_id'] = $userId;
    }
}
