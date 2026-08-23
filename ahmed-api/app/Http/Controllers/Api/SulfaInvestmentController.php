<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SulfaInvestmentController extends Controller
{
    private const LEGACY_ANNUAL_RATE = 10.5;
    private const PRINCIPAL_RETURN_MONTHS = 24;

    public function show(Request $request)
    {
        $userId = $this->userId($request);
        $entries = $this->entries($userId);

        return response()->json([
            'data' => $this->summary($entries, $userId),
        ]);
    }

    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $entries = $this->entries($userId);

        return response()->json([
            'data' => $entries->map(fn ($item) => $this->normalizeEntry($item))->values(),
            'summary' => $this->summary($entries, $userId),
        ]);
    }

    public function storeEntry(Request $request)
    {
        $data = $this->validatedEntry($request);
        $userId = $this->userId($request);

        $id = DB::table('sulfa_investment_entries')->insertGetId([
            'user_id' => $userId,
            'label' => $data['label'] ?? null,
            'invested_amount' => round((float) $data['invested_amount'], 2),
            'expected_profit' => round((float) $data['expected_profit'], 2),
            'duration_months' => (int) $data['duration_months'],
            'is_active' => $data['is_active'] ?? true,
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $item = DB::table('sulfa_investment_entries')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        return response()->json([
            'data' => $this->normalizeEntry($item),
            'summary' => $this->summary($this->entries($userId), $userId),
        ], 201);
    }

    public function updateEntry(Request $request, int $id)
    {
        $data = $this->validatedEntry($request);
        $userId = $this->userId($request);

        $exists = DB::table('sulfa_investment_entries')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->exists();

        if (! $exists) {
            return response()->json(['message' => 'استثمار سلفة غير موجود'], 404);
        }

        DB::table('sulfa_investment_entries')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->update([
                'label' => $data['label'] ?? null,
                'invested_amount' => round((float) $data['invested_amount'], 2),
                'expected_profit' => round((float) $data['expected_profit'], 2),
                'duration_months' => (int) $data['duration_months'],
                'is_active' => $data['is_active'] ?? true,
                'notes' => $data['notes'] ?? null,
                'updated_at' => now(),
            ]);

        $item = DB::table('sulfa_investment_entries')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        return response()->json([
            'data' => $this->normalizeEntry($item),
            'summary' => $this->summary($this->entries($userId), $userId),
        ]);
    }

    public function destroyEntry(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $deleted = DB::table('sulfa_investment_entries')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->delete();

        return response()->json([
            'data' => ['deleted' => (bool) $deleted],
            'summary' => $this->summary($this->entries($userId), $userId),
        ]);
    }

    public function toggleEntry(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $item = DB::table('sulfa_investment_entries')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (! $item) {
            return response()->json(['message' => 'استثمار سلفة غير موجود'], 404);
        }

        DB::table('sulfa_investment_entries')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->update([
                'is_active' => ! (bool) $item->is_active,
                'updated_at' => now(),
            ]);

        $updated = DB::table('sulfa_investment_entries')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        return response()->json([
            'data' => $this->normalizeEntry($updated),
            'summary' => $this->summary($this->entries($userId), $userId),
        ]);
    }

    // Kept for compatibility with older app versions that only stored one amount.
    public function update(Request $request)
    {
        $data = $request->validate([
            'invested_amount' => ['required', 'numeric', 'min:0'],
        ]);

        $userId = $this->userId($request);
        $amount = round((float) $data['invested_amount'], 2);

        DB::table('sulfa_investments')->updateOrInsert(
            ['user_id' => $userId],
            [
                'invested_amount' => $amount,
                'annual_rate' => self::LEGACY_ANNUAL_RATE,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return $this->show($request);
    }

    private function validatedEntry(Request $request): array
    {
        return $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'invested_amount' => ['required', 'numeric', 'gt:0'],
            'expected_profit' => ['required', 'numeric', 'min:0'],
            'duration_months' => ['required', 'integer', 'min:1', 'max:120'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function entries(int $userId)
    {
        return DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->orderByDesc('is_active')
            ->orderByDesc('id')
            ->get();
    }

    private function normalizeEntry(object $item): array
    {
        $amount = (float) $item->invested_amount;
        $profit = (float) $item->expected_profit;
        $months = max(1, (int) $item->duration_months);
        $monthlyProfit = $profit / $months;
        $annualizedRate = $amount > 0 ? (($monthlyProfit * 12) / $amount) * 100 : 0;

        return [
            'id' => $item->id,
            'user_id' => $item->user_id,
            'label' => $item->label,
            'invested_amount' => round($amount, 2),
            'expected_profit' => round($profit, 2),
            'duration_months' => $months,
            'monthly_profit' => round($monthlyProfit, 2),
            'annualized_rate' => round($annualizedRate, 3),
            'is_active' => (bool) $item->is_active,
            'notes' => $item->notes,
            'created_at' => $item->created_at,
            'updated_at' => $item->updated_at,
        ];
    }

    private function summary($entries, int $userId): array
    {
        $active = $entries->filter(fn ($item) => (bool) $item->is_active);

        if ($active->isEmpty()) {
            $legacy = DB::table('sulfa_investments')->where('user_id', $userId)->first();
            if ($legacy && (float) $legacy->invested_amount > 0 && $entries->isEmpty()) {
                $amount = (float) $legacy->invested_amount;
                $rate = (float) ($legacy->annual_rate ?? self::LEGACY_ANNUAL_RATE);
                $monthlyProfit = ($amount * ($rate / 100)) / 12;

                return [
                    'user_id' => $userId,
                    'active_count' => 0,
                    'invested_amount' => round($amount, 2),
                    'total_expected_profit' => 0,
                    'monthly_profit' => round($monthlyProfit, 2),
                    'annual_profit' => round($monthlyProfit * 12, 2),
                    'annual_rate' => round($rate, 3),
                    'weighted_annual_rate' => round($rate, 3),
                    'principal_return_months' => self::PRINCIPAL_RETURN_MONTHS,
                    'monthly_principal_return' => round($amount / self::PRINCIPAL_RETURN_MONTHS, 2),
                ];
            }
        }

        $totalInvestment = $active->sum(fn ($item) => (float) $item->invested_amount);
        $totalExpectedProfit = $active->sum(fn ($item) => (float) $item->expected_profit);
        $monthlyProfit = $active->sum(function ($item) {
            return (float) $item->expected_profit / max(1, (int) $item->duration_months);
        });
        $weightedAnnualRate = $totalInvestment > 0
            ? (($monthlyProfit * 12) / $totalInvestment) * 100
            : 0;

        return [
            'user_id' => $userId,
            'active_count' => $active->count(),
            'invested_amount' => round($totalInvestment, 2),
            'total_expected_profit' => round($totalExpectedProfit, 2),
            'monthly_profit' => round($monthlyProfit, 2),
            'annual_profit' => round($monthlyProfit * 12, 2),
            'annual_rate' => round($weightedAnnualRate, 3),
            'weighted_annual_rate' => round($weightedAnnualRate, 3),
            'principal_return_months' => self::PRINCIPAL_RETURN_MONTHS,
            'monthly_principal_return' => round($totalInvestment / self::PRINCIPAL_RETURN_MONTHS, 2),
        ];
    }

    private function userId(Request $request): int
    {
        return (int) $request->attributes->get('ahmed_user_id');
    }
}
