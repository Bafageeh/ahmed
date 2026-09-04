<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SNAPSHOT_DATE = '2026-09-04';
    private const SNAPSHOT_SOURCE = 'sulfa_portfolio_screenshots_2026_09_04';
    private const DETAIL_SOURCE = 'sulfa_portfolio_screenshots_2026_09_04_batch_2';
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
        $rows = [
            ['1220750864', 300.00, 10000.00, 24,  2.29, 'regular'],
            ['1220953651', 500.00,  9000.00, 24,  2.26, 'regular'],
            ['1221581752', 500.00,  9000.00, 24,  0.00, 'regular'],
            ['1221516526',1000.00, 10000.00, 24,  2.29, 'regular'],
            ['1220675621', 700.00,  7000.00, 24,  2.21, 'regular'],

            ['1219535575', 300.00,  3500.00, 24,  2.10, 'regular'],
            ['1219613726', 300.00,  4500.00, 24,  2.14, 'regular'],
            ['1219195143', 500.00,  9000.00, 24,  0.00, 'regular'],
            ['1220235648', 300.00,  9000.00, 24,  2.26, 'regular'],
            ['1220689875', 300.00, 16500.00, 24,  2.45, 'regular'],

            ['1215129981', 800.00,  8500.00, 24,  2.25, 'regular'],
            ['1218314897',1000.00, 15000.00, 24,  2.41, 'regular'],
            ['1218559876', 300.00, 10000.00, 24,  2.29, 'regular'],
            ['1218579615', 100.00,  2000.00, 24,  2.01, 'regular'],
            ['1219212332', 300.00, 15000.00, 24,  2.41, 'regular'],

            ['1215550683', 200.00,  2500.00, 24,  2.05, 'regular'],
            ['1216174719', 500.00,  9000.00, 24,  2.26, 'regular'],
            ['1216326878', 300.00, 10000.00, 24,  0.00, 'regular'],
            ['1216388904', 500.00,  9500.00,  7, 11.56, 'regular'],
            ['1217326731', 500.00, 14000.00, 24,100.00, 'completed'],

            ['1215442815', 900.00,  9000.00,  3, 31.00, 'regular'],
            ['1215655929', 300.00, 14500.00, 21,  2.85, 'regular'],
            ['1215498454', 300.00, 10000.00, 24,  2.29, 'regular'],
            ['1215217661', 300.00, 10000.00,  9,  8.46, 'regular'],
            ['1215659925', 800.00,  8000.00, 24,  4.59, 'regular'],

            ['1213985825', 300.00,  9000.00, 24,  2.26, 'regular'],
            ['1214043922', 300.00, 10000.00, 24,  2.29, 'regular'],
            ['1213321708', 300.00, 10000.00, 16,  3.96, 'regular'],
            ['1214966140', 300.00, 10000.00, 24,  0.00, 'regular'],
            ['1215610130', 300.00,  9000.00, 24,  2.26, 'regular'],

            ['1213913365', 300.00,  3000.00, 24,  2.07, 'regular'],
            ['1213729478', 100.00,  4000.00, 24,  0.00, 'regular'],
            ['1213867826', 500.00,  9000.00, 18,  3.35, 'regular'],
            ['1214078180', 500.00, 10000.00, 24,  2.29, 'regular'],
            ['1212848115', 300.00,  9000.00, 24,  2.26, 'regular'],

            ['1212211604', 200.00,  7000.00, 24,  2.21, 'regular'],
            ['1212205816', 500.00,  9500.00, 24,  2.27, 'regular'],
            ['1214008818', 300.00,  3500.00, 24,  0.00, 'regular'],
            ['1214002891', 600.00,  6000.00, 24,  2.18, 'regular'],
            ['1214045520', 200.00,  5500.00, 24,  2.17, 'regular'],

            ['1206566559', 100.00, 12500.00, 24,  2.35, 'regular'],
            ['1207195720',1000.00, 10500.00, 24,  4.71, 'regular'],
            ['1207267130',1200.00, 20000.00, 24,  2.53, 'regular'],
            ['1212223714', 800.00,  8500.00, 23,  2.38, 'regular'],
            ['1212489415', 500.00,  5000.00, 24,  0.00, 'regular'],
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
                    // The screenshot proves completion by the snapshot date, but does not expose the exact completion date.
                    if ($existing && empty($existing->completed_at)) {
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

            // Previous screenshot: one additional wallet deposit at 04:02 PM on 2026-09-04.
            if (Schema::hasTable('sulfa_investment_transactions')) {
                DB::table('sulfa_investment_transactions')->updateOrInsert(
                    [
                        'user_id' => $userId,
                        'source_key' => 'deposit|wallet|2026-09-04|16:02:00|3000.00|1',
                    ],
                    [
                        'transaction_type' => 'deposit',
                        'opportunity_number' => null,
                        'amount' => 3000.00,
                        'transaction_date' => '2026-09-04',
                        'transaction_time' => '16:02:00',
                        'status' => 'completed',
                        'source' => self::DETAIL_SOURCE,
                        'source_sequence' => 1,
                        'notes' => 'إيداع في محفظة سلفة',
                        'created_at' => '2026-09-04 16:02:00',
                        'updated_at' => now(),
                    ]
                );
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
                        'visible_opportunity_count' => 90,
                        'notes' => 'القيم الإجمالية من رأس شاشة استثمارات سلفة؛ تم توثيق 90 بطاقة ظاهرة بالكامل عبر دفعتين من الصور دون تكرار أرقام الفرص.',
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
        ];
        $expected = [
            'count' => 45,
            'unique_count' => 45,
            'invested_sum' => 20400.00,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException('Sulfa portfolio batch 2 verification failed: ' . json_encode($actual));
        }
    }

    private function assertImported(int $userId, array $rows): void
    {
        $numbers = array_column($rows, 0);
        $count = DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->whereIn('opportunity_number', $numbers)
            ->count();

        if ((int) $count !== 45) {
            throw new RuntimeException('Sulfa portfolio batch 2 database verification failed; expected 45 opportunities, found ' . $count);
        }

        $completed = DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->where('opportunity_number', '1217326731')
            ->first();

        if (! $completed || (string) $completed->status !== 'completed' || (float) $completed->repayment_progress_percent !== 100.0) {
            throw new RuntimeException('Sulfa completed opportunity verification failed for #1217326731.');
        }
    }
};
