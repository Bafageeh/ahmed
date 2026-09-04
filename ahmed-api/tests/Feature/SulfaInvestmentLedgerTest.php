<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SulfaInvestmentLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_sulfa_image_history_is_idempotent_and_drives_statistics(): void
    {
        $token = 'sulfa-test-session';
        $userId = DB::table('users')->insertGetId([
            'name' => 'أحمد',
            'username' => 'ahmed',
            'email' => 'ahmed@example.test',
            'password' => Hash::make('secret'),
            'remember_token' => hash('sha256', $token),
            'is_admin' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('sulfa_investment_entries')->insert([
            'user_id' => $userId,
            'label' => 'الاستثمار السابق',
            'invested_amount' => 99999,
            'expected_profit' => 0,
            'duration_months' => 24,
            'is_active' => true,
            'notes' => 'تم ترحيله تلقائيًا من المبلغ السابق في سلفة.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migration = require database_path(
            'migrations/2026_09_04_101000_import_sulfa_transaction_history_from_images.php'
        );
        $migration->up();
        $migration->up();

        $this->assertSame(
            72,
            DB::table('sulfa_investment_transactions')->where('user_id', $userId)->count()
        );
        $this->assertSame(
            38,
            DB::table('sulfa_investment_entries')
                ->where('user_id', $userId)
                ->whereNotNull('opportunity_number')
                ->count()
        );
        $this->assertSame(
            1,
            DB::table('sulfa_investment_entries')
                ->where('user_id', $userId)
                ->where('status', 'replaced')
                ->count()
        );

        $response = $this->withToken($token)->getJson('/api/sulfa/investment');

        $response
            ->assertOk()
            ->assertJsonPath('data.invested_amount', 20900)
            ->assertJsonPath('data.monthly_profit', 182.88)
            ->assertJsonPath('data.monthly_principal_return', 870.83)
            ->assertJsonPath('data.stats.total_invested_amount', 20900)
            ->assertJsonPath('data.stats.opportunity_count', 38)
            ->assertJsonPath('data.stats.total_deposits', 29052)
            ->assertJsonPath('data.stats.distributed_profits', 451.84)
            ->assertJsonPath('data.stats.wallet_balance', 8603.84)
            ->assertJsonPath('data.stats.transaction_count', 72)
            ->assertJsonCount(38, 'data.entries')
            ->assertJsonCount(72, 'data.transactions');
    }

    public function test_sulfa_transactions_can_be_filtered_by_type_date_and_opportunity(): void
    {
        $token = 'sulfa-filter-session';
        $userId = DB::table('users')->insertGetId([
            'name' => 'أحمد',
            'username' => 'ahmed',
            'email' => 'ahmed-filter@example.test',
            'password' => Hash::make('secret'),
            'remember_token' => hash('sha256', $token),
            'is_admin' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migration = require database_path(
            'migrations/2026_09_04_101000_import_sulfa_transaction_history_from_images.php'
        );
        $migration->up();

        $response = $this->withToken($token)->getJson(
            '/api/sulfa/investment?type=profit_distribution&from_date=2026-07-30&to_date=2026-07-30&search=1191408901'
        );

        $response
            ->assertOk()
            ->assertJsonCount(2, 'data.transactions')
            ->assertJsonPath('data.transactions.0.transaction_type', 'profit_distribution')
            ->assertJsonPath('data.transactions.0.opportunity_number', '1191408901')
            ->assertJsonPath('data.filters.type', 'profit_distribution');

        $this->assertSame(
            72,
            DB::table('sulfa_investment_transactions')->where('user_id', $userId)->count()
        );
    }

    public function test_additional_sulfa_history_is_idempotent_and_has_no_duplicates(): void
    {
        $token = 'sulfa-batch-two-session';
        $userId = DB::table('users')->insertGetId([
            'name' => 'أحمد',
            'username' => 'ahmed',
            'email' => 'ahmed-batch-two@example.test',
            'password' => Hash::make('secret'),
            'remember_token' => hash('sha256', $token),
            'is_admin' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $firstMigration = require database_path(
            'migrations/2026_09_04_101000_import_sulfa_transaction_history_from_images.php'
        );
        $additionalMigration = require database_path(
            'migrations/2026_09_04_102000_import_additional_sulfa_transaction_history.php'
        );

        $firstMigration->up();
        $additionalMigration->up();
        $additionalMigration->up();

        $transactions = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId)
            ->get();

        $this->assertCount(142, $transactions);
        $this->assertCount(142, $transactions->pluck('source_key')->unique());
        $this->assertSame(
            91,
            DB::table('sulfa_investment_entries')
                ->where('user_id', $userId)
                ->whereNotNull('opportunity_number')
                ->count()
        );

        $response = $this->withToken($token)->getJson('/api/sulfa/investment');

        $response
            ->assertOk()
            ->assertJsonPath('data.invested_amount', 42000)
            ->assertJsonPath('data.monthly_profit', 367.5)
            ->assertJsonPath('data.monthly_principal_return', 1750)
            ->assertJsonPath('data.monthly_cash_flow', 2117.5)
            ->assertJsonPath('data.stats.total_invested_amount', 42000)
            ->assertJsonPath('data.stats.opportunity_count', 91)
            ->assertJsonPath('data.stats.investment_transaction_count', 91)
            ->assertJsonPath('data.stats.deposit_count', 19)
            ->assertJsonPath('data.stats.profit_distribution_count', 32)
            ->assertJsonPath('data.stats.total_deposits', 43112)
            ->assertJsonPath('data.stats.distributed_profits', 786.99)
            ->assertJsonPath('data.stats.wallet_balance', 1898.99)
            ->assertJsonPath('data.stats.transaction_count', 142)
            ->assertJsonCount(91, 'data.entries')
            ->assertJsonCount(142, 'data.transactions');
    }

    public function test_third_sulfa_history_batch_is_idempotent_and_updates_statistics(): void
    {
        $token = 'sulfa-batch-three-session';
        $userId = DB::table('users')->insertGetId([
            'name' => 'أحمد',
            'username' => 'ahmed',
            'email' => 'ahmed-batch-three@example.test',
            'password' => Hash::make('secret'),
            'remember_token' => hash('sha256', $token),
            'is_admin' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $firstMigration = require database_path(
            'migrations/2026_09_04_101000_import_sulfa_transaction_history_from_images.php'
        );
        $secondMigration = require database_path(
            'migrations/2026_09_04_102000_import_additional_sulfa_transaction_history.php'
        );
        $thirdMigration = require database_path(
            'migrations/2026_09_04_103000_import_third_sulfa_transaction_history.php'
        );

        $firstMigration->up();
        $secondMigration->up();
        $thirdMigration->up();
        $thirdMigration->up();

        $transactions = DB::table('sulfa_investment_transactions')
            ->where('user_id', $userId)
            ->get();

        $this->assertCount(212, $transactions);
        $this->assertCount(212, $transactions->pluck('source_key')->unique());
        $this->assertSame(
            105,
            DB::table('sulfa_investment_entries')
                ->where('user_id', $userId)
                ->whereNotNull('opportunity_number')
                ->count()
        );

        $response = $this->withToken($token)->getJson('/api/sulfa/investment');

        $response
            ->assertOk()
            ->assertJsonPath('data.invested_amount', 46700)
            ->assertJsonPath('data.monthly_profit', 408.63)
            ->assertJsonPath('data.monthly_principal_return', 1945.83)
            ->assertJsonPath('data.monthly_cash_flow', 2354.46)
            ->assertJsonPath('data.stats.total_invested_amount', 46700)
            ->assertJsonPath('data.stats.opportunity_count', 105)
            ->assertJsonPath('data.stats.investment_transaction_count', 105)
            ->assertJsonPath('data.stats.deposit_count', 20)
            ->assertJsonPath('data.stats.profit_distribution_count', 87)
            ->assertJsonPath('data.stats.total_deposits', 45112)
            ->assertJsonPath('data.stats.distributed_profits', 2966.2)
            ->assertJsonPath('data.stats.wallet_balance', 1378.2)
            ->assertJsonPath('data.stats.transaction_count', 212)
            ->assertJsonCount(105, 'data.entries')
            ->assertJsonCount(212, 'data.transactions');
    }
}
