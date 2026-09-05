<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SNAPSHOT_DATE = '2026-09-05';
    private const SOURCE = 'sulfa_portfolio_screenshot_2026_09_05_0903';
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
        // Only cards fully readable in the supplied screenshot are imported. The partially cut card above
        // them is intentionally not guessed, even though the portfolio header proves the overall total.
        $rows = [
            ['1230360938', 500.00, 9000.00, 17, 0.00, 'regular'],
            ['1226321983', 300.00, 8500.00, 24, 0.00, 'regular'],
            ['1231934832', 300.00, 6500.00, 24, 0.00, 'regular'],
            ['1232013500', 300.00, 9000.00, 24, 0.00, 'regular'],
            ['1232033553', 600.00, 8500.00, 18, 0.00, 'regular'],
        ];

        $this->assertSourceRows($rows);

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
                    'is_active' => true,
                    'status' => 'active',
                    'completed_at' => null,
                    'updated_at' => now(),
                ];

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
                        'notes' => 'تم إدخال الفرصة من صورة قائمة استثمارات سلفة؛ تاريخ الاستثمار غير ظاهر في المصدر.',
                        'created_at' => now(),
                    ]));
                }
            }

            // Header values are authoritative and are stored independently from the readable cards.
            if (Schema::hasTable('sulfa_portfolio_snapshots')) {
                DB::table('sulfa_portfolio_snapshots')->updateOrInsert(
                    [
                        'user_id' => $userId,
                        'snapshot_date' => self::SNAPSHOT_DATE,
                        'source' => self::SOURCE,
                    ],
                    [
                        'total_investments' => 54100.00,
                        'outstanding_investments' => 51708.59,
                        'principal_repaid' => 2391.41,
                        'visible_opportunity_count' => 122,
                        'notes' => 'لقطة 2026-09-05: إجمالي الاستثمارات 54,100 والقائمة 51,708.59. أضيفت 5 بطاقات كاملة جديدة دون تكرار. توجد بطاقة مقطوعة أعلى الصورة لم يتم تخمين بياناتها؛ لذلك قد يوجد فرق 1,000 ريال بين مجموع الفرص الموثقة ورأس إجمالي المنصة.',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }

            // Keep the legacy Sulfa headline amount aligned with the platform's authoritative total.
            // Detailed opportunity rows remain strictly source-backed and therefore do not invent the hidden card.
            if (Schema::hasTable('sulfa_investments')) {
                DB::table('sulfa_investments')->updateOrInsert(
                    ['user_id' => $userId],
                    [
                        'invested_amount' => 54100.00,
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
        // Financial history and snapshots are intentionally retained during deployment rollbacks.
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

    private function assertSourceRows(array $rows): void
    {
        $numbers = array_column($rows, 0);
        $actual = [
            'count' => count($rows),
            'unique_count' => count(array_unique($numbers, SORT_STRING)),
            'invested_sum' => round((float) array_sum(array_column($rows, 1)), 2),
            'borrower_sum' => round((float) array_sum(array_column($rows, 2)), 2),
        ];

        $expected = [
            'count' => 5,
            'unique_count' => 5,
            'invested_sum' => 2000.00,
            'borrower_sum' => 41500.00,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException('Sulfa Sep 5 portfolio source verification failed: ' . json_encode($actual));
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
                throw new RuntimeException('Sulfa Sep 5 opportunity was not imported: ' . $opportunityNumber);
            }

            if (
                round((float) $entry->invested_amount, 2) !== round((float) $investedAmount, 2)
                || round((float) $entry->borrower_amount, 2) !== round((float) $borrowerAmount, 2)
                || (int) $entry->duration_months !== (int) $durationMonths
                || round((float) $entry->repayment_progress_percent, 2) !== round((float) $progress, 2)
                || (string) $entry->platform_status !== $platformStatus
            ) {
                throw new RuntimeException('Sulfa Sep 5 opportunity verification failed: ' . $opportunityNumber);
            }
        }

        if (Schema::hasTable('sulfa_portfolio_snapshots')) {
            $snapshot = DB::table('sulfa_portfolio_snapshots')
                ->where('user_id', $userId)
                ->where('snapshot_date', self::SNAPSHOT_DATE)
                ->where('source', self::SOURCE)
                ->first();

            if (
                ! $snapshot
                || round((float) $snapshot->total_investments, 2) !== 54100.00
                || round((float) $snapshot->outstanding_investments, 2) !== 51708.59
                || round((float) $snapshot->principal_repaid, 2) !== 2391.41
            ) {
                throw new RuntimeException('Sulfa Sep 5 portfolio snapshot verification failed.');
            }
        }
    }
};
