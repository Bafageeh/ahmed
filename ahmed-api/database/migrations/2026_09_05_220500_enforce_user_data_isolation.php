<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $adminId = $this->adminUserId();
        if ($adminId <= 0) {
            return;
        }

        if (Schema::hasTable('monthly_incomes') && ! Schema::hasColumn('monthly_incomes', 'user_id')) {
            Schema::table('monthly_incomes', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id')->nullable()->index()->after('id');
            });
        }

        $this->assignLegacyMonthlyIncomeOwners($adminId);

        // Historical rows created before multi-user isolation belong to the original
        // administrator unless they already carry an explicit owner.
        foreach ([
            'secure_vault_items',
            'financial_transactions',
            'income_sources',
            'external_app_links',
            'investment_accounts',
            'investment_investors',
            'investment_opportunities',
            'investment_opportunity_allocations',
            'ta3meed_receipts',
            'ta3meed_receipt_allocations',
            'ta3meed_investor_account_entries',
            'dinar_investments',
            'dinar_payments',
            'tokenize_investments',
            'tokenize_payments',
            'sulfa_investments',
            'personal_expenses',
            'debts',
            'credit_card_debts',
        ] as $table) {
            $this->backfillNullOwner($table, $adminId);
        }

        $this->removeAccidentallyCopiedDinarSeed($adminId);
    }

    public function down(): void
    {
        // Ownership backfills and privacy cleanup are intentionally not reversed.
        // Only remove the column introduced by this migration.
        if (Schema::hasTable('monthly_incomes') && Schema::hasColumn('monthly_incomes', 'user_id')) {
            Schema::table('monthly_incomes', function (Blueprint $table) {
                $table->dropIndex(['user_id']);
                $table->dropColumn('user_id');
            });
        }
    }

    private function adminUserId(): int
    {
        if (! Schema::hasTable('users')) {
            return 0;
        }

        if (Schema::hasColumn('users', 'is_admin')) {
            $adminId = DB::table('users')->where('is_admin', true)->orderBy('id')->value('id');
            if ($adminId) {
                return (int) $adminId;
            }
        }

        return (int) (DB::table('users')->orderBy('id')->value('id') ?: 0);
    }

    private function assignLegacyMonthlyIncomeOwners(int $adminId): void
    {
        if (! Schema::hasTable('monthly_incomes') || ! Schema::hasColumn('monthly_incomes', 'user_id')) {
            return;
        }

        $wealthRows = DB::table('monthly_incomes')
            ->where('screen', 'like', 'wealth-%')
            ->get(['id', 'screen']);

        foreach ($wealthRows as $row) {
            if (! preg_match('/^wealth-(\d+)$/', (string) $row->screen, $matches)) {
                continue;
            }

            $ownerId = (int) $matches[1];
            $ownerExists = $ownerId > 0 && DB::table('users')->where('id', $ownerId)->exists();

            DB::table('monthly_incomes')
                ->where('id', $row->id)
                ->update([
                    'user_id' => $ownerExists ? $ownerId : $adminId,
                    'screen' => 'wealth',
                    'updated_at' => now(),
                ]);
        }

        DB::table('monthly_incomes')->whereNull('user_id')->update(['user_id' => $adminId]);
    }

    private function backfillNullOwner(string $table, int $adminId): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'user_id')) {
            return;
        }

        DB::table($table)->whereNull('user_id')->update(['user_id' => $adminId]);
    }

    private function removeAccidentallyCopiedDinarSeed(int $adminId): void
    {
        if (! Schema::hasTable('dinar_investments') || ! Schema::hasTable('dinar_payments')) {
            return;
        }
        if (! Schema::hasColumn('dinar_investments', 'user_id') || ! Schema::hasColumn('dinar_payments', 'user_id')) {
            return;
        }

        $seedKeys = [
            'mohammed-al-taleb',
            'alkarama',
            'almahatta',
            'kifah-12m',
            'kifah-6m',
            'asloob',
            'gulf-gate',
            'alameen',
            '0116-162',
            '0201-128',
        ];

        $userQuery = DB::table('users')->where('id', '!=', $adminId);
        if (Schema::hasColumn('users', 'is_admin')) {
            $userQuery->where(function ($query) {
                $query->whereNull('is_admin')->orWhere('is_admin', false);
            });
        }

        foreach ($userQuery->pluck('id') as $userIdValue) {
            $userId = (int) $userIdValue;
            $seedRows = DB::table('dinar_investments')
                ->where('user_id', $userId)
                ->whereIn('external_key', $seedKeys)
                ->get(['id', 'external_key']);

            // The old bug copied all ten built-in Ahmed investments to a new user.
            // Requiring the full signature prevents deleting a user's genuine Dinar rows.
            $presentKeys = $seedRows->pluck('external_key')->filter()->unique()->values();
            if ($presentKeys->count() !== count($seedKeys)) {
                continue;
            }

            $investmentIds = $seedRows->pluck('id')->map(fn ($id) => (int) $id)->all();

            DB::transaction(function () use ($userId, $investmentIds) {
                DB::table('dinar_payments')
                    ->where('user_id', $userId)
                    ->where(function ($query) use ($investmentIds) {
                        if (count($investmentIds)) {
                            $query->whereIn('dinar_investment_id', $investmentIds);
                        }
                        $query->orWhere(function ($unlinked) {
                            $unlinked->whereNull('dinar_investment_id')
                                ->where('notes', 'مدفوع ظاهر في الصورة وغير مربوط بفرصة مدخلة');
                        });
                    })
                    ->delete();

                if (count($investmentIds)) {
                    DB::table('dinar_investments')
                        ->where('user_id', $userId)
                        ->whereIn('id', $investmentIds)
                        ->delete();
                }
            });
        }
    }
};
