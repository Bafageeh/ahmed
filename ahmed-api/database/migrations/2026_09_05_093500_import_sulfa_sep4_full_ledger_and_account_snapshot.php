<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SOURCE = 'sulfa_ledger_screenshots_2026_09_05_1830';
    private const SNAPSHOT_DATE = '2026-09-05';

    public function up(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasTable('sulfa_investment_transactions')) {
            return;
        }

        $this->ensureAccountSnapshotsTable();

        $userId = $this->ahmedUserId();
        if (! $userId) {
            return;
        }

        // Investment ledger rows proven by the two supplied account-history screenshots.
        // Deposits already imported earlier (+3,000 today 01:15, +3,000 on Sep 4 and +500 on Sep 4)
        // are intentionally NOT inserted again.
        $investments = [
            ['1231934832', 300.00, '2026-09-04'],
            ['1230360938', 500.00, '2026-09-04'],
            ['1231644556', 300.00, '2026-09-04'],
            // #1230902430 was already imported from the previous ledger screenshot, so it is excluded here.
            ['1231541248', 400.00, '2026-09-04'],
            ['1231548125', 400.00, '2026-09-04'],
            ['1231421898', 500.00, '2026-09-04'],
            ['1231336806', 300.00, '2026-09-04'],
        ];

        $this->assertSourceDataset($investments);

        DB::transaction(function () use ($userId, $investments) {
            $sequence = 1;

            foreach ($investments as [$opportunityNumber, $amount, $date]) {
                $this->upsertTransaction(
                    $userId,
                    $opportunityNumber,
                    $amount,
                    $date,
                    $sequence++
                );

                $this->applyProvenInvestmentDate(
                    $userId,
                    $opportunityNumber,
                    $amount,
                    $date
                );
            }

            // Account header shown in the screenshot captured on 2026-09-05.
            if (Schema::hasTable('sulfa_account_snapshots')) {
                DB::table('sulfa_account_snapshots')->updateOrInsert(
                    [
                        'user_id' => $userId,
                        'snapshot_date' => self::SNAPSHOT_DATE,
                        'source' => self::SOURCE,
                    ],
                    [
                        'wallet_balance' => 2845.60,
                        'realized_profit' => 64.98,
                        'realized_profit_percent' => 1.19,
                        'notes' => 'من شاشة حساب سلفة: حجم المحفظة 2,845.60 ريال، الأرباح المحققة 64.98 ريال، النسبة 1.19%.',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }

            $this->assertImported($userId, $investments);
        });
    }

    public function down(): void
    {
        // Financial history and snapshots are intentionally retained during deployment rollbacks.
    }

    private function ensureAccountSnapshotsTable(): void
    {
        if (Schema::hasTable('sulfa_account_snapshots')) {
            return;
        }

        Schema::create('sulfa_account_snapshots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->date('snapshot_date')->index();
            $table->decimal('wallet_balance', 14, 2)->default(0);
            $table->decimal('realized_profit', 14, 2)->default(0);
            $table->decimal('realized_profit_percent', 8, 4)->nullable();
            $table->string('source', 120);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'snapshot_date', 'source'], 'sulfa_account_snapshots_user_date_source_unique');
        });
    }

    private function upsertTransaction(
        int $userId,
        string $opportunityNumber,
        float $amount,
        string $date,
        int $sequence
    ): void {
        $sourceKey = implode('|', [
            'investment',
            $opportunityNumber,
            $date,
            'date-only',
            number_format($amount, 2, '.', ''),
            '1',
        ]);

        DB::table('sulfa_investment_transactions')->updateOrInsert(
            [
                'user_id' => $userId,
                'source_key' => $sourceKey,
            ],
            [
                'transaction_type' => 'investment',
                'opportunity_number' => $opportunityNumber,
                'amount' => $amount,
                'transaction_date' => $date,
                'transaction_time' => null,
                'status' => 'completed',
                'source' => self::SOURCE,
                'source_sequence' => $sequence,
                'notes' => 'استثمار في فرصة سلفة #' . $opportunityNumber,
                'created_at' => $date . ' 12:00:00',
                'updated_at' => now(),
            ]
        );
    }

    private function applyProvenInvestmentDate(
        int $userId,
        string $opportunityNumber,
        float $amount,
        string $date
    ): void {
        if (! Schema::hasTable('sulfa_investment_entries')) {
            return;
        }

        $entry = DB::table('sulfa_investment_entries')
            ->where('user_id', $userId)
            ->where('opportunity_number', $opportunityNumber)
            ->first();

        if (! $entry) {
            throw new RuntimeException('Sulfa opportunity missing before ledger enrichment: ' . $opportunityNumber);
        }

        $updates = [
            'invested_amount' => $amount,
            'investment_date' => $date,
            'updated_at' => now(),
        ];

        if (! empty($entry->duration_months) && (int) $entry->duration_months > 0) {
            $updates['maturity_date'] = Carbon::parse($date)
                ->addMonthsNoOverflow((int) $entry->duration_months)
                ->toDateString();
        }

        DB::table('sulfa_investment_entries')
            ->where('id', $entry->id)
            ->update($updates);
    }

    private function assertSourceDataset(array $investments): void
    {
        $numbers = array_column($investments, 0);
        $actual = [
            'count' => count($investments),
            'unique_count' => count(array_unique($numbers, SORT_STRING)),
            'invested_sum' => round((float) array_sum(array_column($investments, 1)), 2),
        ];

        $expected = [
            'count' => 7,
            'unique_count' => 7,
            'invested_sum' => 2700.00,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException('Sulfa Sep 4 ledger source verification failed: ' . json_encode($actual));
        }
    }

    private function assertImported(int $userId, array $investments): void
    {
        foreach ($investments as [$opportunityNumber, $amount, $date]) {
            $sourceKey = 'investment|' . $opportunityNumber . '|' . $date . '|date-only|' . number_format($amount, 2, '.', '') . '|1';

            $tx = DB::table('sulfa_investment_transactions')
                ->where('user_id', $userId)
                ->where('source_key', $sourceKey)
                ->first();

            if (
                ! $tx
                || (string) $tx->transaction_type !== 'investment'
                || (string) $tx->opportunity_number !== $opportunityNumber
                || round((float) $tx->amount, 2) !== round($amount, 2)
                || (string) $tx->transaction_date !== $date
            ) {
                throw new RuntimeException('Sulfa ledger transaction verification failed: ' . $opportunityNumber);
            }

            if (Schema::hasTable('sulfa_investment_entries')) {
                $entry = DB::table('sulfa_investment_entries')
                    ->where('user_id', $userId)
                    ->where('opportunity_number', $opportunityNumber)
                    ->first();

                if (
                    ! $entry
                    || round((float) $entry->invested_amount, 2) !== round($amount, 2)
                    || (string) $entry->investment_date !== $date
                ) {
                    throw new RuntimeException('Sulfa opportunity date enrichment verification failed: ' . $opportunityNumber);
                }
            }
        }

        if (Schema::hasTable('sulfa_account_snapshots')) {
            $snapshot = DB::table('sulfa_account_snapshots')
                ->where('user_id', $userId)
                ->where('snapshot_date', self::SNAPSHOT_DATE)
                ->where('source', self::SOURCE)
                ->first();

            if (
                ! $snapshot
                || round((float) $snapshot->wallet_balance, 2) !== 2845.60
                || round((float) $snapshot->realized_profit, 2) !== 64.98
                || round((float) $snapshot->realized_profit_percent, 2) !== 1.19
            ) {
                throw new RuntimeException('Sulfa account snapshot verification failed.');
            }
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
