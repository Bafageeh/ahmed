<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MoneyMoonController extends Controller
{
    public function index()
    {
        $platform = DB::table('investment_platforms')->where('code', 'moneymoon')->first();

        if (! $platform) {
            return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        }

        return response()->json([
            'data' => DB::table('investment_opportunities')
                ->where('platform_id', $platform->id)
                ->orderByDesc('id')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validatedData($request);
        $platform = $this->moneyMoonPlatform();

        if (! $platform) {
            return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        }

        $accountId = DB::table('investment_accounts')->where('platform_id', $platform->id)->value('id');

        if (! $accountId) {
            $accountId = DB::table('investment_accounts')->insertGetId([
                'platform_id' => $platform->id,
                'display_name' => 'MoneyMoon Wallet',
                'currency' => 'SAR',
                'wallet_balance' => 0,
                'total_invested_snapshot' => 0,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $dates = $this->investmentDates($data);
        $profitRate = $this->profitRate($data['category']);
        $expectedProfit = $this->expectedProfit($data['amount'], $profitRate);

        $id = DB::table('investment_opportunities')->insertGetId([
            'account_id' => $accountId,
            'platform_id' => $platform->id,
            'title' => 'MoneyMoon ' . $data['category'],
            'investment_type' => 'moneymoon',
            'principal_amount' => $data['amount'],
            'expected_profit_amount' => $expectedProfit,
            'actual_profit_amount' => 0,
            'expected_rate' => $profitRate,
            'start_date' => $dates['investment_date'],
            'maturity_date' => $dates['maturity_date'],
            'status' => 'active',
            'profit_distribution' => 'at_maturity',
            'metadata' => json_encode([
                'category' => $data['category'],
                'profit_rate' => $profitRate,
                'manual_maturity' => ! empty($data['maturity_date']),
            ]),
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('investment_opportunities')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, int $id)
    {
        $data = $this->validatedData($request);
        $platform = $this->moneyMoonPlatform();

        if (! $platform) {
            return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        }

        $investment = DB::table('investment_opportunities')
            ->where('id', $id)
            ->where('platform_id', $platform->id)
            ->first();

        if (! $investment) {
            return response()->json(['message' => 'Investment not found'], 404);
        }

        $dates = $this->investmentDates($data);
        $profitRate = $this->profitRate($data['category']);
        $expectedProfit = $this->expectedProfit($data['amount'], $profitRate);

        DB::table('investment_opportunities')
            ->where('id', $id)
            ->update([
                'title' => 'MoneyMoon ' . $data['category'],
                'principal_amount' => $data['amount'],
                'expected_profit_amount' => $expectedProfit,
                'expected_rate' => $profitRate,
                'start_date' => $dates['investment_date'],
                'maturity_date' => $dates['maturity_date'],
                'metadata' => json_encode([
                    'category' => $data['category'],
                    'profit_rate' => $profitRate,
                    'manual_maturity' => ! empty($data['maturity_date']),
                ]),
                'notes' => $data['notes'] ?? null,
                'updated_at' => now(),
            ]);

        return response()->json(['data' => DB::table('investment_opportunities')->where('id', $id)->first()]);
    }

    public function receive(int $id)
    {
        $platform = $this->moneyMoonPlatform();

        if (! $platform) {
            return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        }

        $investment = DB::table('investment_opportunities')
            ->where('id', $id)
            ->where('platform_id', $platform->id)
            ->first();

        if (! $investment) {
            return response()->json(['message' => 'Investment not found'], 404);
        }

        DB::table('investment_opportunities')
            ->where('id', $id)
            ->update([
                'status' => 'received',
                'actual_profit_amount' => $investment->expected_profit_amount,
                'completed_at' => now()->toDateString(),
                'updated_at' => now(),
            ]);

        return response()->json(['data' => DB::table('investment_opportunities')->where('id', $id)->first()]);
    }

    private function moneyMoonPlatform()
    {
        return DB::table('investment_platforms')->where('code', 'moneymoon')->first();
    }

    private function validatedData(Request $request): array
    {
        return $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'category' => ['required', 'in:A,B,C,D'],
            'investment_date' => ['required', 'date'],
            'maturity_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    private function investmentDates(array $data): array
    {
        $investmentDate = Carbon::parse($data['investment_date']);
        $maturityDate = ! empty($data['maturity_date'])
            ? Carbon::parse($data['maturity_date'])
            : $investmentDate->copy()->addMonthNoOverflow();

        return [
            'investment_date' => $investmentDate->toDateString(),
            'maturity_date' => $maturityDate->toDateString(),
        ];
    }

    private function profitRate(string $category): float
    {
        return [
            'A' => 2,
            'B' => 2,
            'C' => 3,
            'D' => 4,
        ][$category] ?? 0;
    }

    private function expectedProfit(float|int|string $amount, float $profitRate): float
    {
        return round(((float) $amount) * ($profitRate / 100), 2);
    }
}
