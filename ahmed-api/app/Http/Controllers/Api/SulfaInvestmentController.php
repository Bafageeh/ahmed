<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SulfaInvestmentController extends Controller
{
    private const ANNUAL_RATE = 10.5;
    private const PRINCIPAL_RETURN_MONTHS = 24;

    public function show(Request $request)
    {
        $userId = $this->userId($request);
        $item = DB::table('sulfa_investments')
            ->where('user_id', $userId)
            ->first();

        return response()->json([
            'data' => $this->normalize($item, $userId),
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'invested_amount' => ['required', 'numeric', 'min:0'],
        ]);

        $userId = $this->userId($request);
        $amount = round((float) $data['invested_amount'], 2);
        $existing = DB::table('sulfa_investments')
            ->where('user_id', $userId)
            ->first();

        if ($existing) {
            DB::table('sulfa_investments')
                ->where('user_id', $userId)
                ->update([
                    'invested_amount' => $amount,
                    'annual_rate' => self::ANNUAL_RATE,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('sulfa_investments')->insert([
                'user_id' => $userId,
                'invested_amount' => $amount,
                'annual_rate' => self::ANNUAL_RATE,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $item = DB::table('sulfa_investments')
            ->where('user_id', $userId)
            ->first();

        return response()->json([
            'data' => $this->normalize($item, $userId),
        ]);
    }

    private function userId(Request $request): int
    {
        return (int) $request->attributes->get('ahmed_user_id');
    }

    private function normalize(?object $item, int $userId): array
    {
        $amount = (float) ($item->invested_amount ?? 0);
        $annualRate = (float) ($item->annual_rate ?? self::ANNUAL_RATE);
        $annualProfit = $amount * ($annualRate / 100);
        $monthlyProfit = $annualProfit / 12;
        $monthlyPrincipalReturn = $amount / self::PRINCIPAL_RETURN_MONTHS;

        return [
            'id' => $item->id ?? null,
            'user_id' => $userId,
            'invested_amount' => round($amount, 2),
            'annual_rate' => round($annualRate, 3),
            'annual_profit' => round($annualProfit, 2),
            'monthly_profit' => round($monthlyProfit, 2),
            'principal_return_months' => self::PRINCIPAL_RETURN_MONTHS,
            'monthly_principal_return' => round($monthlyPrincipalReturn, 2),
            'created_at' => $item->created_at ?? null,
            'updated_at' => $item->updated_at ?? null,
        ];
    }
}
