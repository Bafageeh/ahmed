<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ANNUAL_RATE = 10.5;
    private const DURATION_MONTHS = 24;
    private const SOURCE = 'sulfa_screenshots_2026_09_04_batch_2';

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
            ['1213321708', 300.00, '2026-08-13'],
            ['1214043922', 300.00, '2026-08-13'],
            ['1213985825', 300.00, '2026-08-13'],
            ['1212848115', 300.00, '2026-08-13'],
            ['1214078180', 500.00, '2026-08-13'],
            ['1213867826', 500.00, '2026-08-13'],
            ['1213729478', 100.00, '2026-08-13'],
            ['1214966140', 300.00, '2026-08-14'],
            ['1215659925', 800.00, '2026-08-15'],
            ['1215217661', 300.00, '2026-08-15'],
            ['1215498454', 300.00, '2026-08-15'],
            ['1215655929', 300.00, '2026-08-15'],
            ['1215442815', 900.00, '2026-08-15'],
            ['1215610130', 300.00, '2026-08-15'],
            ['1215550683', 200.00, '2026-08-15'],
            ['1216388904', 500.00, '2026-08-16'],
            ['1216326878', 300.00, '2026-08-16'],
            ['1216174719', 500.00, '2026-08-16'],
            ['1215129981', 800.00, '2026-08-17'],
            ['1217326731', 500.00, '2026-08-17'],
            ['1218314897', 1000.00, '2026-08-18'],
            ['1219212332', 300.00, '2026-08-19'],
            ['1218579615', 100.00, '2026-08-19'],
            ['1218559876', 300.00, '2026-08-19'],
            ['1219195143', 500.00, '2026-08-20'],
            ['1219613726', 300.00, '2026-08-20'],
            ['1219535575', 300.00, '2026-08-20'],
            ['1220235648', 300.00, '2026-08-21'],
            ['1220689875', 300.00, '2026-08-21'],
            ['1220953651', 500.00, '2026-08-22'],
            ['1220750864', 300.00, '2026-08-22'],
            ['1220675621', 700.00, '2026-08-23'],
            ['1221516526', 1000.00, '2026-08-23'],
            ['1221581752', 500.00, '2026-08-23'],
            ['1221766358', 300.00, '2026-08-23'],
            ['1220058790', 300.00, '2026-08-23'],
            ['1222366931', 300.00, '2026-08-24'],
            ['1222368183', 300.00, '2026-08-24'],
            ['1221979394', 300.00, '2026-08-24'],
            ['1222957384', 300.00, '2026-08-25'],
            ['1222654944', 500.00, '2026-08-25'],
            ['1222824982', 200.00, '2026-08-25'],
            ['1222182655', 200.00, '2026-08-25'],
            ['1223408643', 500.00, '2026-08-26'],
            ['1223614214', 300.00, '2026-08-26'],
            ['1224801382', 500.00, '2026-08-27'],
            ['1224663142', 300.00, '2026-08-27'],
            ['1224344266', 300.00, '2026-08-27'],
            ['1221318443', 300.00, '2026-08-27'],
            ['1224225653', 400.00, '2026-08-27'],
            ['1224859923', 500.00, '2026-08-28'],
            ['1224138358', 500.00, '2026-08-28'],
            ['1226250752', 100.00, '2026-08-29'],
        ];

        $deposits = [
            [60.00, '2026-08-16', 1],
            [10000.00, '2026-08-18', 1],
            [2000.00, '2026-08-26', 1],
            [2000.00, '2026-08-28', 1],
        ];

        $profitDistributions = [
            ['1207195720', 36.19, '2026-08-16'],
            ['1215217661', 30.97, '2026-08-17'],
            ['1215659925', 28.45, '2026-08-17'],
            ['1215659925', 27.77, '2026-08-17'],
            ['1187034570', 38.90, '2026-08-19'],
            ['1218579615', 2.75, '2026-08-23'],
            ['1221766358', 30.87, '2026-08-25'],
            ['1215498454', 10.83, '2026-08-25'],
            ['1220750864', 10.83, '2026-08-26'],
            ['1217326731', 18.35, '2026-08-27'],
            ['1216388904', 67.41, '2026-08-27'],
            ['1192106437', 24.64, '2026-08-30'],
            ['1212211604', 7.19, '2026-08-30'],
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
                        'notes' => 'تم إدخال الفرصة من الدفعة الثانية لصور سجل منصة سلفة.',
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
    ): void {
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
            'investment_count' => 53,
            'investments' => 21100.00,
            'deposit_count' => 4,
            'deposits' => 14060.00,
            'profit_count' => 13,
            'profits' => 335.15,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(
                'Sulfa batch 2 source verification failed: ' . json_encode($actual)
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
            'count' => 70,
            'investment_count' => 53,
            'investments' => 21100.00,
            'deposit_count' => 4,
            'deposits' => 14060.00,
            'profit_count' => 13,
            'profits' => 335.15,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(
                'Sulfa batch 2 import verification failed: ' . json_encode($actual)
            );
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
            throw new RuntimeException('Sulfa batch 2 contains an unlinked profit distribution.');
        }
    }
};
