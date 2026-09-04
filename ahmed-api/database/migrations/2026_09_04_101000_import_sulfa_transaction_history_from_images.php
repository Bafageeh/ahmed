<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ANNUAL_RATE = 10.5;
    private const DURATION_MONTHS = 24;
    private const SOURCE = 'sulfa_screenshots_2026_09_04';

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
            ['1187014294', 1000.00, '2026-07-13'],
            ['1187034570', 1000.00, '2026-07-13'],
            ['1187166835', 1000.00, '2026-07-14'],
            ['1190411796', 700.00, '2026-07-19'],
            ['1191217965', 400.00, '2026-07-19'],
            ['1190889408', 400.00, '2026-07-19'],
            ['1192106437', 700.00, '2026-07-20'],
            ['1191408901', 500.00, '2026-07-20'],
            ['1192988908', 800.00, '2026-07-20'],
            ['1192877182', 300.00, '2026-07-20'],
            ['1192749950', 200.00, '2026-07-20'],
            ['1193400689', 400.00, '2026-07-22'],
            ['1193854169', 200.00, '2026-07-22'],
            ['1194108764', 900.00, '2026-07-22'],
            ['1194453595', 600.00, '2026-07-23'],
            ['1195799540', 500.00, '2026-07-24'],
            ['1195584204', 400.00, '2026-07-24'],
            ['1197886979', 300.00, '2026-07-27'],
            ['1197894417', 500.00, '2026-07-27'],
            ['1197620759', 400.00, '2026-07-27'],
            ['1197495608', 300.00, '2026-07-27'],
            ['1197378118', 300.00, '2026-07-27'],
            ['1197964617', 700.00, '2026-07-27'],
            ['1197762208', 500.00, '2026-07-28'],
            ['1204124125', 900.00, '2026-07-31', '10:29:00'],
            ['1205701623', 400.00, '2026-07-31', '17:20:00'],
            ['1206237918', 900.00, '2026-07-31', '23:49:00'],
            ['1206566559', 100.00, '2026-08-05'],
            ['1207195720', 1000.00, '2026-08-06'],
            ['1207267130', 1200.00, '2026-08-06'],
            ['1212211604', 200.00, '2026-08-12'],
            ['1212205816', 500.00, '2026-08-12'],
            ['1212223714', 800.00, '2026-08-12'],
            ['1212489415', 500.00, '2026-08-12'],
            ['1213913365', 300.00, '2026-08-13'],
            ['1214045520', 200.00, '2026-08-13'],
            ['1214002891', 600.00, '2026-08-13'],
            ['1214008818', 300.00, '2026-08-13'],
        ];

        $deposits = [
            [1000.00, '2026-07-09', null, 1],
            [1000.00, '2026-07-12', null, 1],
            [1000.00, '2026-07-14', null, 1],
            [2000.00, '2026-07-19', null, 1],
            [1000.00, '2026-07-20', null, 1],
            [1000.00, '2026-07-20', null, 2],
            [1500.00, '2026-07-22', null, 1],
            [1465.00, '2026-07-23', null, 1],
            [1000.00, '2026-07-27', null, 1],
            [1927.00, '2026-07-27', null, 2],
            [1000.00, '2026-07-31', '00:00:00', 1],
            [1000.00, '2026-07-31', '18:30:00', 2],
            [2160.00, '2026-08-05', null, 1],
            [2000.00, '2026-08-08', null, 1],
            [10000.00, '2026-08-13', null, 1],
        ];

        $profitDistributions = [
            ['1187034570', 35.35, '2026-07-21'],
            ['1187034570', 37.04, '2026-07-26'],
            ['1187034570', 36.18, '2026-07-26'],
            ['1190889408', 13.05, '2026-07-29'],
            ['1194453595', 20.46, '2026-07-29'],
            ['1187034570', 37.95, '2026-07-29'],
            ['1191217965', 13.35, '2026-07-29'],
            ['1192106437', 24.03, '2026-07-29'],
            ['1195584204', 13.35, '2026-07-29'],
            ['1193400689', 13.05, '2026-07-29'],
            ['1192749950', 5.33, '2026-07-30'],
            ['1192988908', 28.02, '2026-07-30'],
            ['1191408901', 17.98, '2026-07-30'],
            ['1191408901', 18.38, '2026-07-30'],
            ['1187014294', 35.57, '2026-07-30'],
            ['1187166835', 36.46, '2026-07-30'],
            ['1190411796', 24.68, '2026-07-30'],
            ['1194108764', 31.52, '2026-07-30'],
            ['1192877182', 10.09, '2026-07-30'],
        ];

        DB::transaction(function () use ($userId, $investments, $deposits, $profitDistributions) {
            DB::table('sulfa_investment_entries')
                ->where('user_id', $userId)
                ->where('label', 'الاستثمار السابق')
                ->where('notes', 'تم ترحيله تلقائيًا من المبلغ السابق في سلفة.')
                ->update([
                    'is_active' => false,
                    'status' => 'replaced',
                    'notes' => 'أُرشف المبلغ الإجمالي السابق بعد استبداله بسجل الفرص التفصيلي.',
                    'updated_at' => now(),
                ]);

            $sequence = 1;

            foreach ($investments as $row) {
                [$opportunityNumber, $amount, $date] = $row;
                $time = $row[3] ?? null;
                $maturityDate = Carbon::parse($date)->addMonthsNoOverflow(self::DURATION_MONTHS)->toDateString();
                $expectedProfit = round($amount * (self::ANNUAL_RATE / 100) * (self::DURATION_MONTHS / 12), 2);

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
                        'notes' => 'تم إدخال الفرصة من صور سجل منصة سلفة.',
                        'created_at' => $this->timestamp($date, $time),
                        'updated_at' => now(),
                    ]
                );

                $this->upsertTransaction(
                    $userId,
                    'investment',
                    $opportunityNumber,
                    $amount,
                    $date,
                    $time,
                    $sequence++,
                    'استثمار في فرصة سلفة #' . $opportunityNumber
                );
            }

            foreach ($deposits as $row) {
                [$amount, $date, $time, $occurrence] = $row;
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

            foreach ($profitDistributions as $row) {
                [$opportunityNumber, $amount, $date] = $row;
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

            if (Schema::hasTable('sulfa_investments')) {
                $activeTotal = DB::table('sulfa_investment_entries')
                    ->where('user_id', $userId)
                    ->where('is_active', true)
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
        // This migration imports user financial history. Rollback intentionally
        // keeps the records so a deployment rollback cannot erase user data.
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
        $amountKey = number_format($amount, 2, '.', '');
        $sourceKey = implode('|', [
            $type,
            $opportunityNumber ?: 'wallet',
            $date,
            $time ?: 'date-only',
            $amountKey,
            (string) $occurrence,
        ]);

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

    private function timestamp(string $date, ?string $time): string
    {
        return $date . ' ' . ($time ?: '12:00:00');
    }

    private function assertImportedLedger(int $userId): void
    {
        $query = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId)
            ->where('source', self::SOURCE);

        $actual = [
            'count' => (int) (clone $query)->count(),
            'investments' => round((float) (clone $query)
                ->where('transaction_type', 'investment')
                ->sum('amount'), 2),
            'deposits' => round((float) (clone $query)
                ->where('transaction_type', 'deposit')
                ->sum('amount'), 2),
            'profits' => round((float) (clone $query)
                ->where('transaction_type', 'profit_distribution')
                ->sum('amount'), 2),
        ];

        $expected = [
            'count' => 72,
            'investments' => 20900.00,
            'deposits' => 29052.00,
            'profits' => 451.84,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(
                'Sulfa screenshot import verification failed: ' . json_encode($actual)
            );
        }
    }
};
