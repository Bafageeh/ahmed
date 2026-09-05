<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SNAPSHOT_DATE = '2026-09-05';
    private const SNAPSHOT_SOURCE = 'sulfa_portfolio_screenshot_2026_09_05_0903';
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
        // #1231541248 was already documented earlier and is intentionally upserted, not duplicated.
        $rows = [
            ['1231541248', 400.00, 11000.00, 15, 0.00, 'regular'],
            ['1231749446', 400.00,  9000.00, 24, 0.00, 'regular'],
            ['1230902430', 300.00, 15000.00, 24, 0.00, 'regular'],
            ['1231750134', 300.00,  9000.00, 24, 0.00, 'regular'],
            ['1231644556', 300.00, 12000.00, 24, 0.00, 'regular'],
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

                if ($opportunityNumber === '1230902430') {
                    // The transaction screenshot previously proved the investment date.
                    $values['investment_date'] = '2026-09-04';
                    $values['maturity_date'] = '2028-09-04';
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
                        'investment_date' => $opportunityNumber === '1230902430' ? '2026-09-04' : null,
                        'maturity_date' => $opportunityNumber === '1230902430' ? '2028-09-04' : null,
                        'notes' => $opportunityNumber === '1230902430'
                            ? 'تم استكمال تفاصيل الفرصة من صورة قائمة استثمارات سلفة وربطها بحركة الاستثمار المؤرخة 2026-09-04.'
                            : 'تم إدخال الفرصة من صورة قائمة استثمارات سلفة؛ تاريخ الاستثمار غير ظاهر في المصدر.',
                        'created_at' => now(),
                    ]));
                }
            }

            // Update the same Sep 5 snapshot rather than creating another duplicate snapshot row.
            if (Schema::hasTable('sulfa_portfolio_snapshots')) {
                DB::table('sulfa_portfolio_snapshots')->updateOrInsert(
                    [
                        'user_id' => $userId,
                        'snapshot_date' => self::SNAPSHOT_DATE,
                        'source' => self::SNAPSHOT_SOURCE,
                    ],
                    [
                        'total_investments' => 54100.00,
                        'outstanding_investments' => 51708.59,
                        'principal_repaid' => 2391.41,
                        'visible_opportunity_count' => 126,
                        'notes' => 'لقطة 2026-09-05 بعد استكمال الصورة التالية: تم توثيق 126 فرصة فريدة بالكامل. الفرصة #1231541248 كانت موجودة مسبقاً ولم تتكرر. تم استكمال تفاصيل #1230902430، والفرص #1231749446 و#1231750134 و#1231644556 تفسر فرق 1,000 ريال الذي كان غير موثق بالتفصيل في الصورة السابقة. البطاقة المقطوعة أعلى الصورة الحالية لم يتم تخمين بياناتها.',
                        'updated_at' => now(),
                    ]
                );
            }

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
            'invested_sum' => 1700.00,
            'borrower_sum' => 56000.00,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException('Sulfa Sep 5 additional portfolio source verification failed: ' . json_encode($actual));
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
                throw new RuntimeException('Sulfa Sep 5 additional opportunity was not imported: ' . $opportunityNumber);
            }

            if (
                round((float) $entry->invested_amount, 2) !== round((float) $investedAmount, 2)
                || round((float) $entry->borrower_amount, 2) !== round((float) $borrowerAmount, 2)
                || (int) $entry->duration_months !== (int) $durationMonths
                || round((float) $entry->repayment_progress_percent, 2) !== round((float) $progress, 2)
                || (string) $entry->platform_status !== $platformStatus
            ) {
                throw new RuntimeException('Sulfa Sep 5 additional opportunity verification failed: ' . $opportunityNumber);
            }
        }

        $duplicateCount = DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->where('opportunity_number', '1231541248')
            ->count();

        if ((int) $duplicateCount !== 1) {
            throw new RuntimeException('Sulfa duplicate prevention failed for opportunity #1231541248.');
        }

        $dated = DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->where('opportunity_number', '1230902430')
            ->first();

        if (! $dated || (string) $dated->investment_date !== '2026-09-04') {
            throw new RuntimeException('Sulfa investment date verification failed for #1230902430.');
        }

        if (Schema::hasTable('sulfa_portfolio_snapshots')) {
            $snapshot = DB::table('sulfa_portfolio_snapshots')
                ->where('user_id', $userId)
                ->where('snapshot_date', self::SNAPSHOT_DATE)
                ->where('source', self::SNAPSHOT_SOURCE)
                ->first();

            if (
                ! $snapshot
                || round((float) $snapshot->total_investments, 2) !== 54100.00
                || round((float) $snapshot->outstanding_investments, 2) !== 51708.59
                || (int) $snapshot->visible_opportunity_count !== 126
            ) {
                throw new RuntimeException('Sulfa Sep 5 updated snapshot verification failed.');
            }
        }
    }
};
