<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SulfaInvestmentController extends Controller
{
    private const ANNUAL_RATE = 10.5;
    private const PRINCIPAL_RETURN_MONTHS = 24;

    private const TYPE_LABELS = [
        'investment' => 'استثمار',
        'deposit' => 'إيداع',
        'profit_distribution' => 'توزيع أرباح',
    ];

    public function show(Request $request)
    {
        $userId = $this->userId($request);
        $legacyItem = DB::table('sulfa_investments')
            ->where('user_id', $userId)
            ->first();

        if (! $this->hasDetailedLedger()) {
            return response()->json([
                'data' => $this->normalizeLegacy($legacyItem, $userId),
            ]);
        }

        $entries = DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->where('status', '!=', 'replaced')
            ->orderByDesc('investment_date')
            ->orderByDesc('id')
            ->get();

        $transactions = $this->transactionQuery($request, $userId)
            ->orderByDesc('transaction_date')
            ->orderByRaw('CASE WHEN transaction_time IS NULL THEN 0 ELSE 1 END DESC')
            ->orderByDesc('transaction_time')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($transaction) => $this->normalizeTransaction($transaction));

        $allTransactions = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId)
            ->get();

        $entries = $this->normalizeEntries($entries, $allTransactions);
        $stats = $this->summary($entries, $allTransactions);

        return response()->json([
            'data' => [
                'id' => $legacyItem->id ?? null,
                'user_id' => $userId,
                'invested_amount' => $stats['active_invested_amount'],
                'annual_rate' => $stats['average_annual_rate'],
                'annual_profit' => $stats['annual_profit'],
                'monthly_profit' => $stats['monthly_profit'],
                'principal_return_months' => self::PRINCIPAL_RETURN_MONTHS,
                'monthly_principal_return' => $stats['monthly_principal_return'],
                'monthly_cash_flow' => $stats['monthly_cash_flow'],
                'stats' => $stats,
                'entries' => $entries->values(),
                'transactions' => $transactions->values(),
                'filters' => $this->activeFilters($request),
                'created_at' => $legacyItem->created_at ?? null,
                'updated_at' => $legacyItem->updated_at ?? null,
            ],
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'invested_amount' => ['required', 'numeric', 'min:0'],
        ]);

        $userId = $this->userId($request);

        if (
            $this->hasDetailedLedger()
            && DB::table('sulfa_investment_entries')->where('user_id', $userId)->exists()
        ) {
            return response()->json([
                'message' => 'إجمالي استثمار سلفة محسوب تلقائيًا من الفرص المسجلة ولا يُعدّل كمبلغ واحد.',
            ], 422);
        }

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
            'data' => $this->normalizeLegacy($item, $userId),
        ]);
    }

    private function transactionQuery(Request $request, int $userId)
    {
        $query = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId);

        $type = trim((string) $request->query('type', ''));
        if (array_key_exists($type, self::TYPE_LABELS)) {
            $query->where('transaction_type', $type);
        }

        $status = trim((string) $request->query('status', ''));
        if (in_array($status, ['completed', 'pending'], true)) {
            $query->where('status', $status);
        }

        $fromDate = trim((string) $request->query('from_date', ''));
        if ($this->isDate($fromDate)) {
            $query->whereDate('transaction_date', '>=', $fromDate);
        }

        $toDate = trim((string) $request->query('to_date', ''));
        if ($this->isDate($toDate)) {
            $query->whereDate('transaction_date', '<=', $toDate);
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where(function ($nested) use ($search) {
                $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
                $nested->where('opportunity_number', 'like', $like)
                    ->orWhere('notes', 'like', $like);
            });
        }

        return $query;
    }

    private function normalizeEntries($entries, $transactions)
    {
        $profitsByOpportunity = $transactions
            ->where('transaction_type', 'profit_distribution')
            ->whereNotNull('opportunity_number')
            ->groupBy('opportunity_number')
            ->map(fn ($items) => round((float) $items->sum('amount'), 2));

        return $entries->map(function ($entry) use ($profitsByOpportunity) {
            $amount = (float) $entry->invested_amount;
            $distributedProfit = (float) ($profitsByOpportunity->get($entry->opportunity_number, 0));

            $entry->id = (int) $entry->id;
            $entry->user_id = (int) $entry->user_id;
            $entry->invested_amount = round($amount, 2);
            $entry->expected_profit = round((float) $entry->expected_profit, 2);
            $entry->annual_rate = round((float) $entry->annual_rate, 3);
            $entry->duration_months = (int) $entry->duration_months;
            $entry->is_active = (bool) $entry->is_active;
            $entry->distributed_profit = round($distributedProfit, 2);
            $entry->realized_return = $amount > 0
                ? round(($distributedProfit / $amount) * 100, 2)
                : 0;

            return $entry;
        });
    }

    private function normalizeTransaction(object $transaction): object
    {
        $amount = round((float) $transaction->amount, 2);
        $type = (string) $transaction->transaction_type;

        $transaction->id = (int) $transaction->id;
        $transaction->user_id = (int) $transaction->user_id;
        $transaction->amount = $amount;
        $transaction->signed_amount = $type === 'investment' ? -$amount : $amount;
        $transaction->type_label = self::TYPE_LABELS[$type] ?? $type;

        return $transaction;
    }

    private function summary($entries, $transactions): array
    {
        $countableEntries = $entries->filter(
            fn ($entry) => (string) $entry->status !== 'replaced'
        );
        $activeEntries = $countableEntries->filter(
            fn ($entry) => (bool) $entry->is_active && (string) $entry->status === 'active'
        );
        $completedEntries = $countableEntries->filter(
            fn ($entry) => ! (bool) $entry->is_active || (string) $entry->status === 'completed'
        );

        $totalInvested = round((float) $countableEntries->sum('invested_amount'), 2);
        $activeInvested = round((float) $activeEntries->sum('invested_amount'), 2);
        $expectedProfit = round((float) $countableEntries->sum('expected_profit'), 2);
        $distributedProfit = round((float) $transactions
            ->where('transaction_type', 'profit_distribution')
            ->sum('amount'), 2);
        $totalDeposits = round((float) $transactions
            ->where('transaction_type', 'deposit')
            ->sum('amount'), 2);

        $weightedRateNumerator = $activeEntries->sum(
            fn ($entry) => (float) $entry->invested_amount * (float) $entry->annual_rate
        );
        $averageAnnualRate = $activeInvested > 0
            ? round($weightedRateNumerator / $activeInvested, 3)
            : self::ANNUAL_RATE;

        $monthlyProfit = round((float) $activeEntries->sum(function ($entry) {
            $months = max(1, (int) $entry->duration_months);
            return (float) $entry->expected_profit / $months;
        }), 2);
        $monthlyPrincipalReturn = round((float) $activeEntries->sum(function ($entry) {
            $months = max(1, (int) $entry->duration_months);
            return (float) $entry->invested_amount / $months;
        }), 2);

        $opportunityCount = $countableEntries->count();
        $completedCount = $completedEntries->count();
        $walletBalance = round($totalDeposits + $distributedProfit - $totalInvested, 2);

        return [
            'total_invested_amount' => $totalInvested,
            'active_invested_amount' => $activeInvested,
            'opportunity_count' => $opportunityCount,
            'investment_transaction_count' => $transactions->where('transaction_type', 'investment')->count(),
            'deposit_count' => $transactions->where('transaction_type', 'deposit')->count(),
            'profit_distribution_count' => $transactions->where('transaction_type', 'profit_distribution')->count(),
            'transaction_count' => $transactions->count(),
            'total_deposits' => $totalDeposits,
            'distributed_profits' => $distributedProfit,
            'expected_profit' => $expectedProfit,
            'wallet_balance' => $walletBalance,
            'average_return' => $totalInvested > 0
                ? round(($distributedProfit / $totalInvested) * 100, 2)
                : 0,
            'average_annual_rate' => $averageAnnualRate,
            'annual_profit' => round($activeInvested * ($averageAnnualRate / 100), 2),
            'monthly_profit' => $monthlyProfit,
            'monthly_principal_return' => $monthlyPrincipalReturn,
            'monthly_cash_flow' => round($monthlyProfit + $monthlyPrincipalReturn, 2),
            'completed_opportunity_count' => $completedCount,
            'completion_percentage' => $opportunityCount > 0
                ? round(($completedCount / $opportunityCount) * 100, 2)
                : 0,
            'average_duration_months' => $opportunityCount > 0
                ? round((float) $countableEntries->avg('duration_months'), 1)
                : 0,
        ];
    }

    private function activeFilters(Request $request): array
    {
        return [
            'search' => trim((string) $request->query('search', '')),
            'type' => trim((string) $request->query('type', '')),
            'status' => trim((string) $request->query('status', '')),
            'from_date' => trim((string) $request->query('from_date', '')),
            'to_date' => trim((string) $request->query('to_date', '')),
        ];
    }

    private function hasDetailedLedger(): bool
    {
        return Schema::hasTable('sulfa_investment_entries')
            && Schema::hasColumn('sulfa_investment_entries', 'opportunity_number')
            && Schema::hasTable('sulfa_investment_transactions');
    }

    private function isDate(string $value): bool
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return false;
        }

        [$year, $month, $day] = array_map('intval', explode('-', $value));

        return checkdate($month, $day, $year);
    }

    private function userId(Request $request): int
    {
        return max(1, (int) $request->attributes->get('ahmed_user_id', 0));
    }

    private function normalizeLegacy(?object $item, int $userId): array
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
            'monthly_cash_flow' => round($monthlyProfit + $monthlyPrincipalReturn, 2),
            'stats' => null,
            'entries' => [],
            'transactions' => [],
            'created_at' => $item->created_at ?? null,
            'updated_at' => $item->updated_at ?? null,
        ];
    }
}
