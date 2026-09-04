<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ANNUAL_RATE = 10.5;
    private const DURATION_MONTHS = 24;
    private const SOURCE = 'sulfa_screenshots_2026_09_04_batch_4';

    public function up(): void
    {
        if (
            ! Schema::hasTable('users')
            || ! Schema::hasTable('sulfa_investment_entries')
            || ! Schema::hasTable('sulfa_investment_transactions')
        ) {
            return;
        }

        $userId = $this->ahmedUserId();
        if (! $userId) {
            return;
        }

        // أحدث العمليات الظاهرة في صور سجل منصة سلفة المرسلة بتاريخ 2026-09-04.
        $investments = [
            ['1229583973', 500.00, '2026-09-02'],
            ['1230196702', 300.00, '2026-09-03'],
        ];

        $deposits = [
            [2000.00, '2026-09-03', null, 1],
            [500.00, '2026-09-04', '00:01:00', 1],
            [500.00, '2026-09-04', '00:01:00', 2],
        ];

        $profitDistributions = [
            ['1219535575', 9.58, '2026-09-02'],
            ['1219613726', 10.01, '2026-09-02'],
            ['1220235648', 10.75, '2026-09-02'],
            ['1207195720', 37.00, '2026-09-03'],
        ];

        $this->assertSourceDataset($investments, $deposits, $profitDistributions);

        DB::transaction(function () use ($userId, $investments, $deposits, $profitDistributions) {
            $sequence = 1;

            foreach ($investments as [$opportunityNumber, $amount, $date]) {
                $maturityDate = Carbon::parse($date)
                    ->addMonthsNoOverflow(self::DURATION_MONTHS)
                    ->toDateString();
                $expectedProfit = round(
                    $amount * (self::ANNUAL_RATE / 100) * (self::DURATION_MONTHS / 12),
                    2
                );

                DB::table('sulfa_investment_entries')->updateOrInsert(
                    [
                        'user_id' => $userId,
                        'opportunity_number' => $opportunityNumber,
                    ],
                    [
                        'label' => 'فرصة #' . $opportunityNumber,
                        'invested_amount' => $amount,
                        'expected_profit' => $expectedProfit,
                        'annual_rate' => self::ANNUAL_RATE,
                        'duration_months' => self::DURATION_MONTHS,
                        'investment_date' => $date,
                        'maturity_date' => $maturityDate,
                        'is_active' => true,
                        'status' => 'active',
                        'completed_at' => null,
                        'notes' => 'تم إدخال الفرصة من أحدث صور سجل منصة سلفة.',
                        'created_at' => $this->timestamp($date, null),
                        'updated_at' => now(),
                    ]
                );

                $this->upsertTransaction(
                    $userId,
                    'investment',
                    $opportunityNumber,
                    $amount,
                    $date,
                    null,
                    $sequence++,
                    'استثمار في فرصة سلفة #' . $opportunityNumber
                );
            }

            foreach ($deposits as [$amount, $date, $time, $occurrence]) {
                $this->upsertTransaction(
                    $userId,
                    'deposit',
                    null,
                    $amount,
                    $date,
                    $time,
                    $sequence++,
                    'إيداع في محفظة سلفة',
                    $occurrence
                );
            }

            foreach ($profitDistributions as [$opportunityNumber, $amount, $date]) {
                $this->upsertTransaction(
                    $userId,
                    'profit_distribution',
                    $opportunityNumber,
                    $amount,
                    $date,
                    null,
                    $sequence++,
                    'توزيع أرباح للفرصة #' . $opportunityNumber
                );
            }

            $this->assertImportedLedger($userId);
            $this->assertProfitOpportunitiesExist($userId, $profitDistributions);

            if (Schema::hasTable('sulfa_investments')) {
                $activeTotal = DB::table('sulfa_investment_entries')
                    ->where('user_id', $userId)
                    ->where('is_active', true)
                    ->where('status', 'active')
                    ->sum('invested_amount');

                DB::table('sulfa_investments')->updateOrInsert(
                    ['user_id' => $userId],
                    [
                        'invested_amount' => round((float) $activeTotal, 2),
                        'annual_rate' => self::ANNUAL_RATE,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }
        });
    }

    public function down(): void
    {
        // Financial history is intentionally retained during deployment rollbacks.
    }

    private function ahmedUserId(): ?int
    {
        $query = DB::table('users');

        if (Schema::hasColumn('users', 'username')) {
            $id = (int) ($query->whereRaw('LOWER(username) = ?', ['ahmed'])->value('id') ?: 0);
            if ($id > 0) {
                return $id;
            }
        }

        $id = (int) (DB::table('users')->orderBy('id')->value('id') ?: 0);

        return $id > 0 ? $id : null;
    }

    private function upsertTransaction(
        int $userId,
        string $type,
        ?string $opportunityNumber,
        float $amount,
        string $date,
        ?string $time,
        int $sequence,
        string $notes,
        int $occurrence = 1
    ): void {
        $sourceKey = $this->sourceKey(
            $type,
            $opportunityNumber,
            $amount,
            $date,
            $time,
            $occurrence
        );

        DB::table('sulfa_investment_transactions')->updateOrInsert(
            [
                'user_id' => $userId,
                'source_key' => $sourceKey,
            ],
            [
                'transaction_type' => $type,
                'opportunity_number' => $opportunityNumber,
                'amount' => $amount,
                'transaction_date' => $date,
                'transaction_time' => $time,
                'status' => 'completed',
                'source' => self::SOURCE,
                'source_sequence' => $sequence,
                'notes' => $notes,
                'created_at' => $this->timestamp($date, $time),
                'updated_at' => now(),
            ]
        );
    }

    private function sourceKey(
        string $type,
        ?string $opportunityNumber,
        float $amount,
        string $date,
        ?string $time,
        int $occurrence = 1
    ): string {
        return implode('|', [
            $type,
            $opportunityNumber ?: 'wallet',
            $date,
            $time ?: 'date-only',
            number_format($amount, 2, '.', ''),
            (string) $occurrence,
        ]);
    }

    private function timestamp(string $date, ?string $time): string
    {
        return $date . ' ' . ($time ?: '12:00:00');
    }

    private function assertSourceDataset(
        array $investments,
        array $deposits,
        array $profitDistributions
    ): void {
        $sourceKeys = [];

        foreach ($investments as [$opportunityNumber, $amount, $date]) {
            $sourceKeys[] = $this->sourceKey(
                'investment',
                $opportunityNumber,
                $amount,
                $date,
                null
            );
        }

        foreach ($deposits as [$amount, $date, $time, $occurrence]) {
            $sourceKeys[] = $this->sourceKey(
                'deposit',
                null,
                $amount,
                $date,
                $time,
                $occurrence
            );
        }

        foreach ($profitDistributions as [$opportunityNumber, $amount, $date]) {
            $sourceKeys[] = $this->sourceKey(
                'profit_distribution',
                $opportunityNumber,
                $amount,
                $date,
                null
            );
        }

        $actual = [
            'count' => count($sourceKeys),
            'unique_count' => count(array_unique($sourceKeys, SORT_STRING)),
            'investment_count' => count($investments),
            'investments' => round((float) array_sum(array_column($investments, 1)), 2),
            'deposit_count' => count($deposits),
            'deposits' => round((float) array_sum(array_column($deposits, 0)), 2),
            'profit_count' => count($profitDistributions),
            'profits' => round((float) array_sum(array_column($profitDistributions, 1)), 2),
        ];

        $expected = [
            'count' => 9,
            'unique_count' => 9,
            'investment_count' => 2,
            'investments' => 800.00,
            'deposit_count' => 3,
            'deposits' => 3000.00,
            'profit_count' => 4,
            'profits' => 67.34,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(
                'Sulfa batch 4 source verification failed: ' . json_encode($actual)
            );
        }
    }

    private function assertImportedLedger(int $userId): void
    {
        $query = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId)
            ->where('source', self::SOURCE);

        $actual = [
            'count' => (int) (clone $query)->count(),
            'investment_count' => (int) (clone $query)
                ->where('transaction_type', 'investment')
                ->count(),
            'investments' => round((float) (clone $query)
                ->where('transaction_type', 'investment')
                ->sum('amount'), 2),
            'deposit_count' => (int) (clone $query)
                ->where('transaction_type', 'deposit')
                ->count(),
            'deposits' => round((float) (clone $query)
                ->where('transaction_type', 'deposit')
                ->sum('amount'), 2),
            'profit_count' => (int) (clone $query)
                ->where('transaction_type', 'profit_distribution')
                ->count(),
            'profits' => round((float) (clone $query)
                ->where('transaction_type', 'profit_distribution')
                ->sum('amount'), 2),
        ];

        $expected = [
            'count' => 9,
            'investment_count' => 2,
            'investments' => 800.00,
            'deposit_count' => 3,
            'deposits' => 3000.00,
            'profit_count' => 4,
            'profits' => 67.34,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(
                'Sulfa batch 4 database verification failed: ' . json_encode($actual)
            );
        }
    }

    private function assertProfitOpportunitiesExist(int $userId, array $profitDistributions): void
    {
        $opportunityNumbers = collect($profitDistributions)
            ->pluck(0)
            ->unique()
            ->values()
            ->all();

        $existing = DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->whereIn('opportunity_number', $opportunityNumbers)
            ->pluck('opportunity_number')
            ->map(fn ($number) => (string) $number)
            ->unique()
            ->values()
            ->all();

        $missing = array_values(array_diff($opportunityNumbers, $existing));
        if ($missing !== []) {
            throw new RuntimeException(
                'Sulfa batch 4 references unknown opportunities: ' . implode(', ', $missing)
            );
        }
    }
};
