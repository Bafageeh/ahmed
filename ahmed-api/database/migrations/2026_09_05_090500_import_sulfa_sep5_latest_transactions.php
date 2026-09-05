<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SOURCE = 'sulfa_screenshot_2026_09_05_0903';

    public function up(): void
    {
        if (
            ! Schema::hasTable('users')
            || ! Schema::hasTable('sulfa_investment_transactions')
        ) {
            return;
        }

        $userId = $this->ahmedUserId();
        if (! $userId) {
            return;
        }

        DB::transaction(function () use ($userId) {
            // New wallet deposit shown as "today 01:15 AM" in the screenshot captured on 2026-09-05.
            $this->upsertTransaction(
                $userId,
                'deposit',
                null,
                3000.00,
                '2026-09-05',
                '01:15:00',
                1,
                'إيداع في محفظة سلفة'
            );

            // New investment transaction visible in the ledger. The opportunity card details
            // (borrower amount / duration / progress) are not shown here, so they are not guessed.
            $this->upsertTransaction(
                $userId,
                'investment',
                '1230902430',
                300.00,
                '2026-09-04',
                null,
                2,
                'استثمار في فرصة سلفة #1230902430'
            );

            // If this opportunity already exists from another source, enrich only the fields
            // proven by this screenshot. Do not create a portfolio-detail row with an invented duration.
            if (Schema::hasTable('sulfa_investment_entries')) {
                $entry = DB::table('sulfa_investment_entries')
                    ->where('user_id', $userId)
                    ->where('opportunity_number', '1230902430')
                    ->first();

                if ($entry) {
                    $updates = [
                        'invested_amount' => 300.00,
                        'investment_date' => '2026-09-04',
                        'updated_at' => now(),
                    ];

                    if (empty($entry->label)) {
                        $updates['label'] = 'فرصة #1230902430';
                    }

                    DB::table('sulfa_investment_entries')
                        ->where('id', $entry->id)
                        ->update($updates);
                }
            }

            // The older +3,000 and +500 rows dated 2026-09-04 are already present from
            // previous screenshots, so they are intentionally not inserted again.
            $this->assertImported($userId);
        });
    }

    public function down(): void
    {
        // Financial history is intentionally retained during deployment rollbacks.
    }

    private function upsertTransaction(
        int $userId,
        string $type,
        ?string $opportunityNumber,
        float $amount,
        string $date,
        ?string $time,
        int $sequence,
        string $notes
    ): void {
        $sourceKey = implode('|', [
            $type,
            $opportunityNumber ?: 'wallet',
            $date,
            $time ?: 'date-only',
            number_format($amount, 2, '.', ''),
            '1',
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
                'created_at' => $date . ' ' . ($time ?: '12:00:00'),
                'updated_at' => now(),
            ]
        );
    }

    private function assertImported(int $userId): void
    {
        $depositKey = 'deposit|wallet|2026-09-05|01:15:00|3000.00|1';
        $investmentKey = 'investment|1230902430|2026-09-04|date-only|300.00|1';

        $deposit = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId)
            ->where('source_key', $depositKey)
            ->first();

        $investment = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId)
            ->where('source_key', $investmentKey)
            ->first();

        if (
            ! $deposit
            || (string) $deposit->transaction_type !== 'deposit'
            || round((float) $deposit->amount, 2) !== 3000.00
            || (string) $deposit->transaction_date !== '2026-09-05'
            || substr((string) $deposit->transaction_time, 0, 8) !== '01:15:00'
        ) {
            throw new RuntimeException('Sulfa Sep 5 deposit verification failed.');
        }

        if (
            ! $investment
            || (string) $investment->transaction_type !== 'investment'
            || (string) $investment->opportunity_number !== '1230902430'
            || round((float) $investment->amount, 2) !== 300.00
            || (string) $investment->transaction_date !== '2026-09-04'
        ) {
            throw new RuntimeException('Sulfa Sep 4 investment verification failed.');
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
