<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SNAPSHOT_DATE = '2026-09-04';
    private const SNAPSHOT_SOURCE = 'sulfa_portfolio_screenshots_2026_09_04';
    private const ANNUAL_RATE = 10.5;

    public function up(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasTable('sulfa_investment_entries')) {
            return;
        }

        $userId = $this->ahmedUserId();
        if (! $userId) {
            return;
        }

        // [opportunity_number, our_investment, borrower_amount, duration_months, progress_percent, platform_status]
        // Duplicate cards repeated between the supplied screenshots were intentionally included only once.
        $rows = [
            ['1197964617', 700.00, 14500.00, 24,  2.40, 'regular'],
            ['1197762208', 500.00,  9000.00, 24,  4.64, 'regular'],
            ['1204124125', 900.00,  9000.00, 24,  2.26, 'regular'],
            ['1205701623', 400.00,  8000.00, 24,  0.00, 'regular'],
            ['1206237918', 900.00,  9500.00, 24,  2.27, 'regular'],

            ['1197378118', 300.00,  3500.00, 24,  2.10, 'regular'],
            ['1197495608', 300.00,  5500.00, 24,  2.17, 'regular'],
            ['1197620759', 400.00,  6000.00, 24,100.00, 'completed'],
            ['1197894417', 500.00,  9000.00, 24,  2.26, 'regular'],
            ['1197886979', 300.00,  3500.00, 24,  2.10, 'regular'],

            ['1193400689', 400.00,  4500.00, 24,  4.39, 'regular'],
            ['1194108764', 900.00,  9000.00, 24,  4.64, 'regular'],
            ['1194453595', 600.00,  6500.00, 24,  4.51, 'regular'],
            ['1195584204', 400.00,  4500.00, 24,  4.39, 'regular'],
            ['1195799540', 500.00,  9000.00, 23,  2.40, 'regular'],

            ['1192106437', 700.00,  7000.00, 24,  4.53, 'regular'],
            ['1192749950', 200.00,  2000.00, 24,  4.13, 'regular'],
            ['1192877182', 300.00,  3000.00, 22,  4.83, 'regular'],
            ['1192988908', 800.00,  9000.00, 24,  4.64, 'regular'],
            ['1193854169', 200.00,  2000.00, 24,  2.01, 'regular'],

            ['1187166835',1000.00, 20000.00, 24,  5.17, 'regular'],
            ['1190889408', 400.00,  4500.00, 24,  4.39, 'regular'],
            ['1191217965', 400.00,  4500.00, 24,  4.39, 'regular'],
            ['1190411796', 700.00, 10000.00, 24,  4.69, 'regular'],
            ['1191408901', 500.00,  9500.00, 24,  4.66, 'regular'],

            ['1187034570',1000.00, 10500.00, 24, 12.66, 'regular'],
            ['1187014294',1000.00, 11500.00, 24,  4.76, 'regular'],
        ];

        $this->assertRows($rows);

        DB::transaction(function () use ($userId, $rows) {
            foreach ($rows as [$opportunityNumber, $investedAmount, $borrowerAmount, $durationMonths, $progress, $platformStatus]) {
                $expectedProfit = round(
                    $investedAmount * (self::ANNUAL_RATE / 100) * ($durationMonths / 12),
                    2
                );

                $existing = DB::table('sulfa_investment_entries')
                    ->where('user_id', $userId)
                    ->where('opportunity_number', $opportunityNumber)
                    ->first();

                $values = [
                    'invested_amount' => $investedAmount,
                    'expected_profit' => $expectedProfit,
                    'annual_rate' => self::ANNUAL_RATE,
                    'duration_months' => $durationMonths,
                    'borrower_amount' => $borrowerAmount,
                    'repayment_progress_percent' => $progress,
                    'platform_status' => $platformStatus,
                    'portfolio_snapshot_date' => self::SNAPSHOT_DATE,
                    'updated_at' => now(),
                ];

                if ($platformStatus === 'completed') {
                    $values['is_active'] = false;
                    $values['status'] = 'completed';
                    if ($existing && empty($existing->completed_at)) {
                        // Exact completion date is not exposed; snapshot date is the proven latest date.
                        $values['completed_at'] = self::SNAPSHOT_DATE;
                    }
                } else {
                    $values['is_active'] = true;
                    $values['status'] = 'active';
                    $values['completed_at'] = null;
                }

                if ($existing) {
                    DB::table('sulfa_investment_entries')
                        ->where('id', $existing->id)
                        ->update($values);
                } else {
                    DB::table('sulfa_investment_entries')->insert(array_merge($values, [
                        'user_id' => $userId,
                        'label' => 'فرصة #' . $opportunityNumber,
                        'opportunity_number' => $opportunityNumber,
                        'investment_date' => null,
                        'maturity_date' => null,
                        'notes' => 'تم إدخال الفرصة من صور قائمة استثمارات سلفة؛ تاريخ الاستثمار غير ظاهر في المصدر.',
                        'created_at' => now(),
                    ]));
                }
            }

            if (Schema::hasTable('sulfa_portfolio_snapshots')) {
                DB::table('sulfa_portfolio_snapshots')->updateOrInsert(
                    [
                        'user_id' => $userId,
                        'snapshot_date' => self::SNAPSHOT_DATE,
                        'source' => self::SNAPSHOT_SOURCE,
                    ],
                    [
                        'total_investments' => 50800.00,
                        'outstanding_investments' => 48408.59,
                        'principal_repaid' => 2391.41,
                        'visible_opportunity_count' => 117,
                        'notes' => 'القيم الإجمالية من رأس شاشة استثمارات سلفة؛ تم توثيق 117 بطاقة ظاهرة بالكامل عبر دفعات الصور دون تكرار أرقام الفرص.',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }

            if (Schema::hasTable('sulfa_investments')) {
                $activeTotal = DB::table('sulfa_investment_entries')
                    ->where('user_id', $userId)
                    ->where('status', '!=', 'replaced')
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

            $this->assertImported($userId, $rows);
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

    private function assertRows(array $rows): void
    {
        $numbers = array_column($rows, 0);
        $actual = [
            'count' => count($rows),
            'unique_count' => count(array_unique($numbers, SORT_STRING)),
            'invested_sum' => round((float) array_sum(array_column($rows, 1)), 2),
            'borrower_sum' => round((float) array_sum(array_column($rows, 2)), 2),
            'completed_count' => count(array_filter($rows, fn ($row) => $row[5] === 'completed')),
        ];

        $expected = [
            'count' => 27,
            'unique_count' => 27,
            'invested_sum' => 15200.00,
            'borrower_sum' => 204500.00,
            'completed_count' => 1,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException('Sulfa portfolio batch 3 source verification failed: ' . json_encode($actual));
        }
    }

    private function assertImported(int $userId, array $rows): void
    {
        foreach ($rows as [$opportunityNumber, $investedAmount, $borrowerAmount, $durationMonths, $progress, $platformStatus]) {
            $entry = DB::table('sulfa_investment_entries')
                ->where('user_id', $userId)
                ->where('opportunity_number', $opportunityNumber)
                ->first();

            if (! $entry) {
                throw new RuntimeException('Sulfa portfolio opportunity was not imported: ' . $opportunityNumber);
            }

            $actualStatus = (string) $entry->platform_status;
            if (
                round((float) $entry->invested_amount, 2) !== round((float) $investedAmount, 2)
                || round((float) $entry->borrower_amount, 2) !== round((float) $borrowerAmount, 2)
                || (int) $entry->duration_months !== (int) $durationMonths
                || round((float) $entry->repayment_progress_percent, 2) !== round((float) $progress, 2)
                || $actualStatus !== $platformStatus
            ) {
                throw new RuntimeException('Sulfa portfolio verification failed for opportunity ' . $opportunityNumber);
            }
        }
    }
};
