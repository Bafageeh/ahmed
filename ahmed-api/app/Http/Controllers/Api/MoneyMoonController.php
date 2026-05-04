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
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'category' => ['required', 'in:A,B,C,D'],
            'investment_date' => ['required', 'date'],
            'maturity_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $platform = DB::table('investment_platforms')->where('code', 'moneymoon')->first();

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

        $investmentDate = Carbon::parse($data['investment_date']);
        $maturityDate = ! empty($data['maturity_date'])
            ? Carbon::parse($data['maturity_date'])
            : $investmentDate->copy()->addMonthNoOverflow();

        $id = DB::table('investment_opportunities')->insertGetId([
            'account_id' => $accountId,
            'platform_id' => $platform->id,
            'title' => 'MoneyMoon ' . $data['category'],
            'investment_type' => 'moneymoon',
            'principal_amount' => $data['amount'],
            'expected_profit_amount' => 0,
            'actual_profit_amount' => 0,
            'start_date' => $investmentDate->toDateString(),
            'maturity_date' => $maturityDate->toDateString(),
            'status' => 'active',
            'profit_distribution' => 'at_maturity',
            'metadata' => json_encode(['category' => $data['category'], 'manual_maturity' => ! empty($data['maturity_date'])]),
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('investment_opportunities')->where('id', $id)->first()], 201);
    }
}
