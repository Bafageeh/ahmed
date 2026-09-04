<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ANNUAL_RATE = 10.5;
    private const DURATION_MONTHS = 24;
    private const SOURCE = 'sulfa_screenshots_2026_09_04_batch_3';

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

        $investments = [
            ['1226017666', 500.00, '2026-08-30'],
            ['1226917539', 400.00, '2026-08-30'],
            ['1226886633', 300.00, '2026-08-30'],
            ['1223502615', 400.00, '2026-08-30'],
            ['1227279752', 300.00, '2026-08-30'],
            ['1227269552', 100.00, '2026-08-30'],
            ['1223494169', 300.00, '2026-08-30'],
            ['1227096944', 300.00, '2026-08-31'],
            ['1227056557', 300.00, '2026-08-31'],
            ['1228054455', 200.00, '2026-08-31'],
            ['1227786684', 400.00, '2026-08-31'],
            ['1228838951', 300.00, '2026-09-01'],
            ['1228594783', 400.00, '2026-09-01'],
            ['1228770529', 500.00, '2026-09-01'],
        ];

        $deposits = [
            [2000.00, '2026-08-31', 1],
        ];

        $profitDistributions = [
            ['1187166835', 37.21, '2026-08-30'],
            ['1220953651', 17.92, '2026-08-30'],
            ['1213913365', 9.26, '2026-08-30'],
            ['1204124125', 31.52, '2026-08-30'],
            ['1195584204', 13.71, '2026-08-30'],
            ['1194108764', 32.27, '2026-08-30'],
            ['1195799540', 18.78, '2026-08-30'],
            ['1221766358', 32.12, '2026-08-30'],
            ['1197762208', 18.75, '2026-08-30'],
            ['1197762208', 18.35, '2026-08-30'],
            ['1220058790', 11.55, '2026-08-30'],
            ['1197495608', 10.04, '2026-08-30'],
            ['1197378118', 9.58, '2026-08-30'],
            ['1190889408', 13.42, '2026-08-30'],
            ['1221516526', 35.26, '2026-08-30'],
            ['1187014294', 36.38, '2026-08-30'],
            ['1206237918', 31.63, '2026-08-30'],
            ['1197886979', 9.58, '2026-08-30'],
            ['1197964617', 25.19, '2026-08-30'],
            ['1191217965', 13.71, '2026-08-30'],
            ['1220689875', 11.08, '2026-08-30'],
            ['1206566559', 3.65, '2026-08-30'],
            ['1193400689', 13.42, '2026-08-30'],
            ['1190411796', 25.26, '2026-08-30'],
            ['1216174719', 17.92, '2026-08-30'],
            ['1192749950', 5.54, '2026-08-30'],
            ['1194453595', 20.98, '2026-08-30'],
            ['1192988908', 28.69, '2026-08-30'],
            ['1207267130', 43.75, '2026-08-30'],
            ['1215610130', 10.75, '2026-08-30'],
            ['1193854169', 5.33, '2026-08-30'],
            ['1192877182', 10.44, '2026-08-30'],
            ['1218314897', 36.02, '2026-08-30'],
            ['1214078180', 17.63, '2026-08-30'],
            ['1212205816', 17.99, '2026-08-30'],
            ['1221979394', 11.07, '2026-08-31'],
            ['1212223714', 29.23, '2026-08-31'],
            ['1220675621', 24.03, '2026-08-31'],
            ['1215550683', 5.87, '2026-08-31'],
            ['1213985825', 10.75, '2026-08-31'],
            ['1213867826', 24.42, '2026-08-31'],
            ['1212848115', 10.75, '2026-08-31'],
            ['1219212332', 11.04, '2026-08-31'],
            ['1215655929', 12.70, '2026-08-31'],
            ['1213321708', 16.71, '2026-08-31'],
            ['1197620759', 420.45, '2026-08-31'],
            ['1215129981', 27.90, '2026-08-31'],
            ['1215442815', 293.71, '2026-08-31'],
            ['1222366931', 11.03, '2026-08-31'],
            ['1217326731', 508.12, '2026-08-31'],
            ['1218559876', 10.83, '2026-09-01'],
            ['1197894417', 17.94, '2026-09-01'],
            ['1214043922', 10.83, '2026-09-01'],
            ['1214045520', 6.86, '2026-09-02'],
            ['1214002891', 20.29, '2026-09-02'],
        ];

        $sourceKeys = $this->assertSourceDataset(
            $investments,
            $deposits,
            $profitDistributions
        );

        DB::transaction(function () use (
            $userId,
            $investments,
            $deposits,
            $profitDistributions,
            $sourceKeys
        ) {
            $existingKeyCount = DB::table('sulfa_investment_transactions')
                ->where('user_id', $userId)
                ->whereIn('source_key', $sourceKeys)
                ->count();
            $transactionCountBefore = DB::table('sulfa_investment_transactions')
                ->where('user_id', $userId)
                ->count();
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
                        'notes' => 'تم إدخال الفرصة من الدفعة الثالثة لصور سجل منصة سلفة.',
                        'created_at' => $this->timestamp($date),
                        'updated_at' => now(),
                    ]
                );

                $this->upsertTransaction(
                    $userId,
                    'investment',
                    $opportunityNumber,
                    $amount,
                    $date,
                    $sequence++,
                    'استثمار في فرصة سلفة #' . $opportunityNumber
                );
            }

            foreach ($deposits as [$amount, $date, $occurrence]) {
                $this->upsertTransaction(
                    $userId,
                    'deposit',
                    null,
                    $amount,
                    $date,
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
                    $sequence++,
                    'توزيع أرباح للفرصة #' . $opportunityNumber
                );
            }

            $this->assertImportedLedger($userId);
            $this->assertNoDuplicateInsertion(
                $userId,
                $sourceKeys,
                $existingKeyCount,
                $transactionCountBefore
            );
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
        int $sequence,
        string $notes,
        int $occurrence = 1
    ): void {
        $sourceKey = $this->sourceKey(
            $type,
            $opportunityNumber,
            $amount,
            $date,
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
                'transaction_time' => null,
                'status' => 'completed',
                'source' => self::SOURCE,
                'source_sequence' => $sequence,
                'notes' => $notes,
                'created_at' => $this->timestamp($date),
                'updated_at' => now(),
            ]
        );
    }

    private function sourceKey(
        string $type,
        ?string $opportunityNumber,
        float $amount,
        string $date,
        int $occurrence = 1
    ): string {
        return implode('|', [
            $type,
            $opportunityNumber ?: 'wallet',
            $date,
            'date-only',
            number_format($amount, 2, '.', ''),
            (string) $occurrence,
        ]);
    }

    private function timestamp(string $date): string
    {
        return $date . ' 12:00:00';
    }

    private function assertSourceDataset(
        array $investments,
        array $deposits,
        array $profitDistributions
    ): array {
        $sourceKeys = [];

        foreach ($investments as [$opportunityNumber, $amount, $date]) {
            $sourceKeys[] = $this->sourceKey(
                'investment',
                $opportunityNumber,
                $amount,
                $date
            );
        }

        foreach ($deposits as [$amount, $date, $occurrence]) {
            $sourceKeys[] = $this->sourceKey('deposit', null, $amount, $date, $occurrence);
        }

        foreach ($profitDistributions as [$opportunityNumber, $amount, $date]) {
            $sourceKeys[] = $this->sourceKey(
                'profit_distribution',
                $opportunityNumber,
                $amount,
                $date
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
            'count' => 70,
            'unique_count' => 70,
            'investment_count' => 14,
            'investments' => 4700.00,
            'deposit_count' => 1,
            'deposits' => 2000.00,
            'profit_count' => 55,
            'profits' => 2179.21,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(
                'Sulfa batch 3 source verification failed: ' . json_encode($actual)
            );
        }

        return $sourceKeys;
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
            'count' => 70,
            'investment_count' => 14,
            'investments' => 4700.00,
            'deposit_count' => 1,
            'deposits' => 2000.00,
            'profit_count' => 55,
            'profits' => 2179.21,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(
                'Sulfa batch 3 import verification failed: ' . json_encode($actual)
            );
        }
    }

    private function assertNoDuplicateInsertion(
        int $userId,
        array $sourceKeys,
        int $existingKeyCount,
        int $transactionCountBefore
    ): void {
        $matchingKeyCount = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId)
            ->whereIn('source_key', $sourceKeys)
            ->count();
        $transactionCountAfter = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId)
            ->count();
        $expectedCountAfter = $transactionCountBefore + count($sourceKeys) - $existingKeyCount;

        if (
            $matchingKeyCount !== count($sourceKeys)
            || $transactionCountAfter !== $expectedCountAfter
        ) {
            throw new RuntimeException('Sulfa batch 3 duplicate prevention verification failed.');
        }
    }

    private function assertProfitOpportunitiesExist(
        int $userId,
        array $profitDistributions
    ): void {
        $opportunityNumbers = array_values(array_unique(array_column($profitDistributions, 0)));
        $linkedCount = DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->whereIn('opportunity_number', $opportunityNumbers)
            ->count();

        if ($linkedCount !== count($opportunityNumbers)) {
            throw new RuntimeException('Sulfa batch 3 contains an unlinked profit distribution.');
        }
    }
};
