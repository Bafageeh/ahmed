<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ANNUAL_RATE = 10.5;
    private const SNAPSHOT_DATE = '2026-09-04';
    private const SOURCE = 'sulfa_portfolio_screenshots_2026_09_04';

    public function up(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasTable('sulfa_investment_entries')) {
            return;
        }

        $this->ensurePortfolioColumns();
        $this->ensureSnapshotTable();

        $userId = $this->ahmedUserId();
        if (! $userId) {
            return;
        }

        // [opportunity_number, our_investment, borrower_amount, duration_months, repayment_progress_percent]
        // Only fully visible cards were transcribed from the supplied screenshots.
        $rows = [
            ['1231310611', 200.00,  7500.00, 24,  0.00],
            ['1231336806', 300.00,  3500.00, 21,  0.00],
            ['1231421898', 500.00, 11000.00, 24,  0.00],
            ['1231548125', 400.00,  4500.00, 24,  0.00],
            ['1231541248', 400.00, 11000.00, 15,  0.00],

            ['1231047335', 300.00, 10000.00, 24,  0.00],
            ['1231037604', 300.00,  9000.00, 15,  0.00],
            ['1230952715', 300.00,  9000.00, 24,  0.00],
            ['1231229647', 300.00, 10000.00, 24,  0.00],
            ['1231137449', 300.00,  5500.00, 23,  0.00],

            ['1228770529', 500.00, 11000.00, 14,  0.00],
            ['1228594783', 400.00, 10000.00, 24,  0.00],
            ['1228838951', 300.00,  9000.00, 24,  0.00],
            ['1229583973', 500.00,  9000.00, 24,  0.00],
            ['1230196702', 300.00,  8500.00, 24,  0.00],

            ['1227279752', 300.00,  7500.00, 24,  0.00],
            ['1227786684', 400.00,  4500.00, 24,  0.00],
            ['1228054455', 200.00,  2000.00, 24,  0.00],
            ['1227056557', 300.00,  5000.00, 24,  0.00],
            ['1227096944', 300.00,  9500.00, 24,  0.00],

            ['1226886633', 300.00,  9000.00, 24,  0.00],
            ['1226917539', 400.00,  9000.00, 24,  0.00],
            ['1223502615', 400.00,  8500.00, 24,  0.00],
            ['1223494169', 300.00, 10000.00, 24,  0.00],
            ['1227269552', 100.00,  5000.00, 24,  0.00],

            ['1224225653', 400.00,  4000.00, 24,  0.00],
            ['1224138358', 500.00,  5500.00,  7,  0.00],
            ['1224859923', 500.00, 10000.00, 24,  0.00],
            ['1226250752', 100.00,  3500.00, 24,  0.00],
            ['1226017666', 500.00, 10500.00, 24,  0.00],

            ['1223614214', 300.00,  8500.00, 24,  0.00],
            ['1221318443', 300.00, 15000.00, 24,  0.00],
            ['1224344266', 300.00,  9000.00, 15,  0.00],
            ['1224663142', 300.00,  9000.00,  6,  0.00],
            ['1224801382', 500.00,  7500.00, 24,  0.00],

            ['1222182655', 200.00,  2500.00, 16,  0.00],
            ['1222824982', 200.00,  2000.00, 24,  0.00],
            ['1222654944', 500.00,  5000.00, 24,  0.00],
            ['1222957384', 300.00, 20000.00, 24,  0.00],
            ['1223408643', 500.00, 15000.00, 24,  0.00],

            ['1220058790', 300.00,  3000.00, 20,  2.68],
            ['1221766358', 300.00,  9000.00,  9, 17.42],
            ['1221979394', 300.00, 16000.00, 24,  2.43],
            ['1222368183', 300.00, 12500.00, 24,  0.00],
            ['1222366931', 300.00, 14500.00, 24,  2.40],
        ];

        $newOpportunityNumbers = [
            '1230952715',
            '1231037604',
            '1231047335',
            '1231137449',
            '1231229647',
            '1231310611',
            '1231336806',
            '1231421898',
            '1231541248',
            '1231548125',
        ];

        $this->assertSourceRows($rows, $newOpportunityNumbers);

        DB::transaction(function () use ($userId, $rows, $newOpportunityNumbers) {
            foreach ($rows as [$opportunityNumber, $investedAmount, $borrowerAmount, $durationMonths, $progress]) {
                $expectedProfit = round(
                    $investedAmount * (self::ANNUAL_RATE / 100) * ($durationMonths / 12),
                    2
                );

                $existing = DB::table('sulfa_investment_entries')
                    ->where('user_id', $userId)
                    ->where('opportunity_number', $opportunityNumber)
                    ->first();

                $detailValues = [
                    'invested_amount' => $investedAmount,
                    'expected_profit' => $expectedProfit,
                    'annual_rate' => self::ANNUAL_RATE,
                    'duration_months' => $durationMonths,
                    'borrower_amount' => $borrowerAmount,
                    'repayment_progress_percent' => $progress,
                    'platform_status' => 'regular',
                    'portfolio_snapshot_date' => self::SNAPSHOT_DATE,
                    'updated_at' => now(),
                ];

                if ($existing) {
                    // Preserve investment date, maturity date and the original transaction-history notes.
                    DB::table('sulfa_investment_entries')
                        ->where('id', $existing->id)
                        ->update($detailValues);
                } else {
                    // The portfolio cards do not show the transaction date, so no date is invented here.
                    DB::table('sulfa_investment_entries')->insert(array_merge($detailValues, [
                        'user_id' => $userId,
                        'label' => 'فرصة #' . $opportunityNumber,
                        'opportunity_number' => $opportunityNumber,
                        'investment_date' => null,
                        'maturity_date' => null,
                        'is_active' => true,
                        'status' => 'active',
                        'completed_at' => null,
                        'notes' => 'تم إدخال الفرصة من صور قائمة استثمارات سلفة؛ تاريخ الاستثمار غير ظاهر في المصدر.',
                        'created_at' => now(),
                    ]));
                }
            }

            DB::table('sulfa_portfolio_snapshots')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'snapshot_date' => self::SNAPSHOT_DATE,
                    'source' => self::SOURCE,
                ],
                [
                    'total_investments' => 50800.00,
                    'outstanding_investments' => 48408.59,
                    'principal_repaid' => 2391.41,
                    'visible_opportunity_count' => 45,
                    'notes' => 'القيم الإجمالية من رأس شاشة استثمارات سلفة؛ تم إدخال 45 بطاقة ظاهرة بالكامل وتجاهل البطاقات المقطوعة لمنع التخمين.',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            // Keep the legacy summary synchronized with the detailed opportunity ledger.
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

            $this->assertImportedPortfolio($userId, $rows, $newOpportunityNumbers);
        });
    }

    public function down(): void
    {
        // User financial history and portfolio snapshots are intentionally retained on rollback.
    }

    private function ensurePortfolioColumns(): void
    {
        $missingBorrower = ! Schema::hasColumn('sulfa_investment_entries', 'borrower_amount');
        $missingProgress = ! Schema::hasColumn('sulfa_investment_entries', 'repayment_progress_percent');
        $missingStatus = ! Schema::hasColumn('sulfa_investment_entries', 'platform_status');
        $missingSnapshotDate = ! Schema::hasColumn('sulfa_investment_entries', 'portfolio_snapshot_date');

        if (! ($missingBorrower || $missingProgress || $missingStatus || $missingSnapshotDate)) {
            return;
        }

        Schema::table('sulfa_investment_entries', function (Blueprint $table) use (
            $missingBorrower,
            $missingProgress,
            $missingStatus,
            $missingSnapshotDate
        ) {
            if ($missingBorrower) {
                $table->decimal('borrower_amount', 15, 2)->nullable();
            }
            if ($missingProgress) {
                $table->decimal('repayment_progress_percent', 7, 3)->nullable();
            }
            if ($missingStatus) {
                $table->string('platform_status', 30)->nullable();
            }
            if ($missingSnapshotDate) {
                $table->date('portfolio_snapshot_date')->nullable();
            }
        });
    }

    private function ensureSnapshotTable(): void
    {
        if (Schema::hasTable('sulfa_portfolio_snapshots')) {
            return;
        }

        Schema::create('sulfa_portfolio_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('snapshot_date')->index();
            $table->decimal('total_investments', 15, 2);
            $table->decimal('outstanding_investments', 15, 2);
            $table->decimal('principal_repaid', 15, 2)->default(0);
            $table->unsignedInteger('visible_opportunity_count')->default(0);
            $table->string('source', 100);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(
                ['user_id', 'snapshot_date', 'source'],
                'sulfa_snapshot_user_date_source_unique'
            );
        });
    }

    private function assertSourceRows(array $rows, array $newOpportunityNumbers): void
    {
        $opportunities = array_column($rows, 0);
        $newRows = array_values(array_filter(
            $rows,
            fn ($row) => in_array($row[0], $newOpportunityNumbers, true)
        ));

        $actual = [
            'row_count' => count($rows),
            'unique_opportunities' => count(array_unique($opportunities, SORT_STRING)),
            'visible_investment_total' => round((float) array_sum(array_column($rows, 1)), 2),
            'borrower_amount_total' => round((float) array_sum(array_column($rows, 2)), 2),
            'new_count' => count($newRows),
            'new_investment_total' => round((float) array_sum(array_column($newRows, 1)), 2),
        ];

        $expected = [
            'row_count' => 45,
            'unique_opportunities' => 45,
            'visible_investment_total' => 15200.00,
            'borrower_amount_total' => 380500.00,
            'new_count' => 10,
            'new_investment_total' => 3300.00,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(
                'Sulfa portfolio source verification failed: ' . json_encode($actual)
            );
        }
    }

    private function assertImportedPortfolio(int $userId, array $rows, array $newOpportunityNumbers): void
    {
        $opportunities = array_column($rows, 0);

        $stored = DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->whereIn('opportunity_number', $opportunities)
            ->get();

        $storedNew = $stored->whereIn('opportunity_number', $newOpportunityNumbers);

        $snapshot = DB::table('sulfa_portfolio_snapshots')
            ->where('user_id', $userId)
            ->where('snapshot_date', self::SNAPSHOT_DATE)
            ->where('source', self::SOURCE)
            ->first();

        $actual = [
            'stored_count' => $stored->count(),
            'unique_count' => $stored->pluck('opportunity_number')->unique()->count(),
            'stored_visible_total' => round((float) $stored->sum('invested_amount'), 2),
            'stored_new_count' => $storedNew->count(),
            'stored_new_total' => round((float) $storedNew->sum('invested_amount'), 2),
            'snapshot_total' => $snapshot ? round((float) $snapshot->total_investments, 2) : null,
            'snapshot_outstanding' => $snapshot ? round((float) $snapshot->outstanding_investments, 2) : null,
        ];

        $expected = [
            'stored_count' => 45,
            'unique_count' => 45,
            'stored_visible_total' => 15200.00,
            'stored_new_count' => 10,
            'stored_new_total' => 3300.00,
            'snapshot_total' => 50800.00,
            'snapshot_outstanding' => 48408.59,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException(
                'Sulfa portfolio database verification failed: ' . json_encode($actual)
            );
        }
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
};
