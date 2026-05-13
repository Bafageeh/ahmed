<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Ta3meedController extends Controller
{
    public function index()
    {
        $platform = $this->platform();

        if (! $platform) {
            return response()->json(['message' => 'Ta3meed platform not found'], 404);
        }

        $items = DB::table('investment_opportunities')
            ->where('platform_id', $platform->id)
            ->orderByDesc('maturity_date')
            ->orderByDesc('id')
            ->get()
            ->map(function ($item) {
                $item->allocations = DB::table('investment_opportunity_allocations')
                    ->join('investment_investors', 'investment_opportunity_allocations.investor_id', '=', 'investment_investors.id')
                    ->where('investment_opportunity_allocations.opportunity_id', $item->id)
                    ->select([
                        'investment_opportunity_allocations.id',
                        'investment_investors.name as investor_name',
                        'investment_investors.code as investor_code',
                        'investment_opportunity_allocations.invested_amount',
                        'investment_opportunity_allocations.expected_profit_amount',
                        'investment_opportunity_allocations.actual_profit_amount',
                        'investment_opportunity_allocations.received_amount',
                        'investment_opportunity_allocations.status',
                    ])
                    ->orderBy('investment_investors.id')
                    ->get();

                $item->receipts = $this->receipts($item->id);
                $this->appendActualAnnualRate($item);

                return $item;
            });

        return response()->json(['data' => $items]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:100'],
            'total_amount' => ['required', 'numeric', 'min:0'],
            'profit' => ['nullable', 'numeric', 'min:0'],
            'profit_rate' => ['nullable', 'numeric', 'min:0'],
            'category' => ['nullable', 'string', 'max:50'],
            'months' => ['nullable', 'integer', 'min:1'],
            'start_date' => ['nullable', 'date'],
            'maturity_date' => ['nullable', 'date'],
            'withdrawal_date' => ['nullable', 'date'],
            'remaining_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'allocations' => ['nullable', 'array'],
            'allocations.*.investor' => ['required_with:allocations', 'string', 'max:100'],
            'allocations.*.amount' => ['required_with:allocations', 'numeric', 'min:0'],
        ]);

        $platform = $this->platform();

        if (! $platform) {
            return response()->json(['message' => 'Ta3meed platform not found'], 404);
        }

        $accountId = $this->accountId($platform->id);
        $totalAmount = round((float) $data['total_amount'], 2);
        $profit = round((float) ($data['profit'] ?? 0), 2);
        $rate = $data['profit_rate'] ?? ($totalAmount > 0 ? round(($profit / $totalAmount) * 100, 4) : null);

        $id = DB::table('investment_opportunities')->insertGetId([
            'account_id' => $accountId,
            'platform_id' => $platform->id,
            'title' => 'تعميد - ' . $data['code'],
            'reference_number' => $data['code'],
            'investment_type' => 'ta3meed',
            'principal_amount' => $totalAmount,
            'expected_profit_amount' => $profit,
            'actual_profit_amount' => 0,
            'expected_rate' => $rate,
            'start_date' => $data['start_date'] ?? null,
            'maturity_date' => $data['maturity_date'] ?? null,
            'status' => 'active',
            'profit_distribution' => 'at_maturity',
            'metadata' => json_encode([
                'category' => $data['category'] ?? null,
                'months' => $data['months'] ?? null,
                'withdrawal_date' => $data['withdrawal_date'] ?? null,
                'remaining_amount' => $data['remaining_amount'] ?? null,
            ], JSON_UNESCAPED_UNICODE),
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach (($data['allocations'] ?? []) as $allocation) {
            $investorId = $this->investorId($allocation['investor']);
            $amount = round((float) $allocation['amount'], 2);
            $allocationProfit = $totalAmount > 0 ? round($profit * ($amount / $totalAmount), 2) : 0;

            DB::table('investment_opportunity_allocations')->insert([
                'opportunity_id' => $id,
                'investor_id' => $investorId,
                'invested_amount' => $amount,
                'expected_profit_amount' => $allocationProfit,
                'actual_profit_amount' => 0,
                'received_amount' => 0,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['data' => DB::table('investment_opportunities')->where('id', $id)->first()], 201);
    }

    public function summary()
    {
        $platform = $this->platform();

        if (! $platform) {
            return response()->json(['message' => 'Ta3meed platform not found'], 404);
        }

        $base = DB::table('investment_opportunities')->where('platform_id', $platform->id);
        $totalReceived = Schema::hasTable('ta3meed_receipts')
            ? round((float) DB::table('ta3meed_receipts')
                ->join('investment_opportunities', 'ta3meed_receipts.opportunity_id', '=', 'investment_opportunities.id')
                ->where('investment_opportunities.platform_id', $platform->id)
                ->sum('ta3meed_receipts.amount'), 2)
            : 0;

        $investors = collect();
        try {
            $investors = DB::table('investment_opportunity_allocations')
                ->join('investment_opportunities', 'investment_opportunity_allocations.opportunity_id', '=', 'investment_opportunities.id')
                ->join('investment_investors', 'investment_opportunity_allocations.investor_id', '=', 'investment_investors.id')
                ->where('investment_opportunities.platform_id', $platform->id)
                ->selectRaw('investment_investors.name, sum(investment_opportunity_allocations.invested_amount) as invested, sum(investment_opportunity_allocations.expected_profit_amount) as profit, sum(investment_opportunity_allocations.received_amount) as received')
                ->groupBy('investment_investors.name')
                ->orderBy('investment_investors.name')
                ->get();
        } catch (\Throwable $e) {
            $investors = collect();
        }

        return response()->json([
            'data' => [
                'active_count' => (clone $base)->where('status', 'active')->count(),
                'partial_received_count' => (clone $base)->where('status', 'partial_received')->count(),
                'received_count' => (clone $base)->where('status', 'received')->count(),
                'total_invested' => round((float) (clone $base)->where('status', 'active')->sum('principal_amount'), 2),
                'total_expected_profit' => round((float) (clone $base)->where('status', 'active')->sum('expected_profit_amount'), 2),
                'total_received' => $totalReceived,
                'investors' => $investors,
            ],
        ]);
    }

    private function receipts(int $opportunityId)
    {
        if (! Schema::hasTable('ta3meed_receipts')) {
            return collect();
        }

        return DB::table('ta3meed_receipts')
            ->where('opportunity_id', $opportunityId)
            ->orderByDesc('receipt_date')
            ->orderByDesc('id')
            ->get()
            ->map(function ($receipt) {
                $receipt->allocations = Schema::hasTable('ta3meed_receipt_allocations')
                    ? DB::table('ta3meed_receipt_allocations')
                        ->leftJoin('investment_investors', 'ta3meed_receipt_allocations.investor_id', '=', 'investment_investors.id')
                        ->where('ta3meed_receipt_allocations.receipt_id', $receipt->id)
                        ->select([
                            'investment_investors.name as investor_name',
                            'ta3meed_receipt_allocations.share_percent',
                            'ta3meed_receipt_allocations.received_amount',
                        ])
                        ->get()
                    : [];

                return $receipt;
            });
    }

    private function appendActualAnnualRate(object $item): void
    {
        $principal = (float) $item->principal_amount;
        $expectedProfit = (float) $item->expected_profit_amount;
        $expectedTotal = $principal + $expectedProfit;
        $registeredAnnualRate = (float) $item->expected_rate;

        if ($registeredAnnualRate <= 0 && $principal > 0 && $expectedProfit > 0) {
            $registeredAnnualRate = ($expectedProfit / $principal) * 100;
        }

        $receivedFromReceipts = collect($item->receipts ?? [])->sum('amount');
        $receivedFromAllocations = collect($item->allocations ?? [])->sum('received_amount');
        $receivedAmount = max((float) $receivedFromReceipts, (float) $receivedFromAllocations);
        $status = strtolower(trim((string) $item->status));
        $closedStatuses = ['received', 'completed', 'closed', 'cancelled', 'canceled', 'finished', 'ended'];
        $isEnded = in_array($status, $closedStatuses, true);
        $actualProfit = max(0, $receivedAmount - $principal);
        $showActualAnnualRate = $isEnded
            && $principal > 0
            && $actualProfit > 0
            && $expectedTotal > 0
            && $receivedAmount < $expectedTotal;

        $item->registered_annual_profit_rate = round($registeredAnnualRate, 6);
        $item->received_amount = round($receivedAmount, 2);
        $item->actual_received_profit_amount = $showActualAnnualRate ? round($actualProfit, 2) : null;
        $item->actual_annual_profit_rate = $showActualAnnualRate ? round(($actualProfit / $principal) * 100, 6) : null;
        $item->show_actual_annual_profit_rate = $showActualAnnualRate;
    }

    private function platform()
    {
        return DB::table('investment_platforms')->where('code', 'ta3meed')->first();
    }

    private function accountId(int $platformId): int
    {
        $id = DB::table('investment_accounts')->where('platform_id', $platformId)->value('id');

        if ($id) {
            return (int) $id;
        }

        return DB::table('investment_accounts')->insertGetId([
            'platform_id' => $platformId,
            'display_name' => 'محفظة تعميد',
            'currency' => 'SAR',
            'wallet_balance' => 0,
            'total_invested_snapshot' => 0,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function investorId(string $name): int
    {
        $code = strtolower(trim(str_replace(' ', '_', $name)));
        $id = DB::table('investment_investors')->where('code', $code)->value('id');

        if ($id) {
            return (int) $id;
        }

        return DB::table('investment_investors')->insertGetId([
            'code' => $code,
            'name' => $name,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
