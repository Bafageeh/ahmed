<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $requiredTables = [
            'users',
            'investment_platforms',
            'investment_accounts',
            'investment_opportunities',
            'investment_investors',
            'investment_opportunity_allocations',
        ];

        foreach ($requiredTables as $table) {
            if (! Schema::hasTable($table)) {
                return;
            }
        }

        $userId = $this->ensureSaraUser();
        $platformId = $this->ensureTa3meedPlatform();
        $accountId = $this->ensureSaraTa3meedAccount($platformId, $userId);
        $investorId = $this->ensureSaraInvestor($userId);

        $rows = [
            ['code' => 'LZXR601', 'amount' => 3000.00, 'months' => 8, 'rate' => 16.32, 'profit' => 326.40, 'category' => 'C', 'maturity_date' => '2025-10-28'],
            ['code' => 'RBOI322', 'amount' => 17970.00, 'months' => 6, 'rate' => 13.92, 'profit' => 1250.71, 'category' => 'B', 'maturity_date' => '2025-10-30'],
            ['code' => 'ER-KNPU252', 'amount' => 12592.00, 'months' => 6, 'rate' => 12.48, 'profit' => 785.74, 'category' => 'A-', 'maturity_date' => '2026-05-25'],
            ['code' => 'ER-BKHH063', 'amount' => 5000.00, 'months' => 6, 'rate' => 12.96, 'profit' => 324.00, 'category' => 'B+', 'maturity_date' => '2026-05-30'],
            ['code' => 'DVKN539', 'amount' => 2800.00, 'months' => 5, 'rate' => 13.536, 'profit' => 157.92, 'category' => 'B', 'maturity_date' => '2026-06-15'],
            ['code' => 'inv-BUMB463', 'amount' => 6546.00, 'months' => 6, 'rate' => 13.632, 'profit' => 446.18, 'category' => 'B', 'maturity_date' => '2026-06-21'],
            ['code' => 'VAVD633', 'amount' => 4407.00, 'months' => 4, 'rate' => 11.04, 'profit' => 162.18, 'category' => 'B', 'maturity_date' => '2026-06-23'],
            ['code' => 'Szud479', 'amount' => 10500.00, 'months' => 6, 'rate' => 13.632, 'profit' => 715.68, 'category' => 'B+', 'maturity_date' => '2026-06-25'],
            ['code' => 'Inv-YFCJ268', 'amount' => 6700.00, 'months' => 6, 'rate' => 13.632, 'profit' => 456.67, 'category' => 'B', 'maturity_date' => '2026-06-29'],
            ['code' => 'BNMG705', 'amount' => 5448.00, 'months' => 6, 'rate' => 12.48, 'profit' => 339.96, 'category' => 'B+', 'maturity_date' => '2026-06-29'],
            ['code' => 'CCTK502', 'amount' => 3900.00, 'months' => 5, 'rate' => 14.016, 'profit' => 227.76, 'category' => 'B', 'maturity_date' => '2026-07-01'],
            ['code' => 'VGYZ692', 'amount' => 1067.00, 'months' => 5, 'rate' => 12.768, 'profit' => 56.76, 'category' => 'B-', 'maturity_date' => '2026-07-11'],
            ['code' => 'Savz343', 'amount' => 1900.00, 'months' => 6, 'rate' => 13.536, 'profit' => 128.59, 'category' => 'B+', 'maturity_date' => '2026-07-19'],
            ['code' => 'FEDR124', 'amount' => 3900.00, 'months' => 6, 'rate' => 13.536, 'profit' => 263.95, 'category' => 'B+', 'maturity_date' => '2026-07-25'],
            ['code' => 'Inv-HYVX427', 'amount' => 5103.00, 'months' => 6, 'rate' => 13.536, 'profit' => 345.37, 'category' => 'B', 'maturity_date' => '2026-07-25'],
            ['code' => 'HYFK862', 'amount' => 5396.00, 'months' => 6, 'rate' => 13.536, 'profit' => 365.20, 'category' => 'B', 'maturity_date' => '2026-08-09'],
            ['code' => 'GOAI882', 'amount' => 3900.00, 'months' => 6, 'rate' => 12.768, 'profit' => 248.98, 'category' => 'B', 'maturity_date' => '2026-08-26'],
            ['code' => 'YEOX420', 'amount' => 2111.00, 'months' => 7, 'rate' => 12.768, 'profit' => 157.23, 'category' => 'A-', 'maturity_date' => '2026-09-24'],
            ['code' => 'CBYN900', 'amount' => 3520.00, 'months' => 6, 'rate' => 12.48, 'profit' => 219.65, 'category' => 'B+', 'maturity_date' => '2026-09-08'],
            ['code' => 'inv-XJDU700', 'amount' => 2408.00, 'months' => 6, 'rate' => 12.768, 'profit' => 153.73, 'category' => 'B', 'maturity_date' => '2026-09-05'],
            ['code' => 'INV-ORRS701', 'amount' => 1833.00, 'months' => 6, 'rate' => 12.00, 'profit' => 109.98, 'category' => 'B+', 'maturity_date' => '2026-09-16'],
            ['code' => 'Inv-XCB0508', 'amount' => 10500.00, 'months' => 6, 'rate' => 13.536, 'profit' => 710.64, 'category' => 'B+', 'maturity_date' => '2026-09-24'],
            ['code' => 'RWXU334', 'amount' => 16972.00, 'months' => 5, 'rate' => 13.536, 'profit' => 957.22, 'category' => 'A-', 'maturity_date' => '2026-08-31'],
            ['code' => 'CMQN595', 'amount' => 5000.00, 'months' => 6, 'rate' => 13.536, 'profit' => 338.40, 'category' => 'B+', 'maturity_date' => '2026-09-30'],
            ['code' => 'TBJO945', 'amount' => 10000.00, 'months' => 6, 'rate' => 13.536, 'profit' => 676.80, 'category' => 'A-', 'maturity_date' => '2026-10-16'],
            ['code' => 'ER-MFQO652', 'amount' => 5000.00, 'months' => 6, 'rate' => 12.00, 'profit' => 300.00, 'category' => 'A', 'maturity_date' => '2026-11-06'],
            ['code' => 'inv-sydx143', 'amount' => 1141.00, 'months' => 6, 'rate' => 12.768, 'profit' => 72.84, 'category' => 'B', 'maturity_date' => null],
            ['code' => 'inv-KAEM382', 'amount' => 10500.00, 'months' => 6, 'rate' => 12.768, 'profit' => 670.32, 'category' => 'B+', 'maturity_date' => null],
            ['code' => 'MAGN383', 'amount' => 20000.00, 'months' => 6, 'rate' => 12.48, 'profit' => 1248.00, 'category' => 'B+', 'maturity_date' => null],
            ['code' => 'LDOC207', 'amount' => 5000.00, 'months' => 6, 'rate' => 13.44, 'profit' => 336.00, 'category' => null, 'maturity_date' => null],
        ];

        foreach ($rows as $row) {
            $this->upsertOpportunity($row, $platformId, $accountId, $investorId, $userId);
        }
    }

    public function down(): void
    {
        // Data import migration: intentionally kept as a no-op to avoid deleting user data on rollback.
    }

    private function ensureSaraUser(): int
    {
        $query = DB::table('users');
        if (Schema::hasColumn('users', 'username')) {
            $query->where('username', 'sara');
        } elseif (Schema::hasColumn('users', 'email')) {
            $query->where('email', 'sara@ahmed.local');
        } else {
            $query->where('name', 'ساره الحلوه');
        }

        $id = $query->value('id');
        if ($id) {
            return (int) $id;
        }

        $insert = [];
        $this->setIfColumn($insert, 'users', 'name', 'ساره الحلوه');
        $this->setIfColumn($insert, 'users', 'username', 'sara');
        $this->setIfColumn($insert, 'users', 'email', 'sara@ahmed.local');
        $this->setIfColumn($insert, 'users', 'password', Hash::make('123456'));
        $this->setIfColumn($insert, 'users', 'is_admin', false);
        $this->touchForInsert($insert, 'users');

        return (int) DB::table('users')->insertGetId($insert);
    }

    private function ensureTa3meedPlatform(): int
    {
        $id = DB::table('investment_platforms')->where('code', 'ta3meed')->value('id');
        if ($id) {
            return (int) $id;
        }

        $insert = [];
        $this->setIfColumn($insert, 'investment_platforms', 'code', 'ta3meed');
        $this->setIfColumn($insert, 'investment_platforms', 'name_ar', 'تعميد');
        $this->setIfColumn($insert, 'investment_platforms', 'name_en', 'Ta3meed');
        $this->setIfColumn($insert, 'investment_platforms', 'name', 'تعميد');
        $this->setIfColumn($insert, 'investment_platforms', 'category', 'crowdfunding');
        $this->setIfColumn($insert, 'investment_platforms', 'calculation_method', 'profit_rate');
        $this->setIfColumn($insert, 'investment_platforms', 'description', null);
        $this->setIfColumn($insert, 'investment_platforms', 'settings', json_encode([], JSON_UNESCAPED_UNICODE));
        $this->setIfColumn($insert, 'investment_platforms', 'is_active', true);
        $this->touchForInsert($insert, 'investment_platforms');

        return (int) DB::table('investment_platforms')->insertGetId($insert);
    }

    private function ensureSaraTa3meedAccount(int $platformId, int $userId): int
    {
        $query = DB::table('investment_accounts')->where('platform_id', $platformId);
        $this->scopeUser($query, 'investment_accounts', $userId);

        $id = $query->value('id');
        if ($id) {
            return (int) $id;
        }

        $insert = [];
        $this->setIfColumn($insert, 'investment_accounts', 'platform_id', $platformId);
        $this->setIfColumn($insert, 'investment_accounts', 'display_name', 'محفظة تعميد - سارة');
        $this->setIfColumn($insert, 'investment_accounts', 'currency', 'SAR');
        $this->setIfColumn($insert, 'investment_accounts', 'wallet_balance', 0);
        $this->setIfColumn($insert, 'investment_accounts', 'total_invested_snapshot', 0);
        $this->setIfColumn($insert, 'investment_accounts', 'is_active', true);
        $this->attachUser($insert, 'investment_accounts', $userId);
        $this->touchForInsert($insert, 'investment_accounts');

        return (int) DB::table('investment_accounts')->insertGetId($insert);
    }

    private function ensureSaraInvestor(int $userId): int
    {
        $query = DB::table('investment_investors')->where('name', 'سارة');
        $this->scopeUser($query, 'investment_investors', $userId);

        $id = $query->value('id');
        if ($id) {
            return (int) $id;
        }

        $insert = [];
        $this->setIfColumn($insert, 'investment_investors', 'code', 'sara_' . $userId);
        $this->setIfColumn($insert, 'investment_investors', 'name', 'سارة');
        $this->setIfColumn($insert, 'investment_investors', 'is_active', true);
        $this->attachUser($insert, 'investment_investors', $userId);
        $this->touchForInsert($insert, 'investment_investors');

        return (int) DB::table('investment_investors')->insertGetId($insert);
    }

    private function upsertOpportunity(array $row, int $platformId, int $accountId, int $investorId, int $userId): void
    {
        $metadata = json_encode([
            'category' => $row['category'],
            'months' => $row['months'],
            'withdrawal_date' => null,
            'remaining_amount' => null,
            'import_source' => 'sara_ta3meed_sheet_image_2026_05_15',
        ], JSON_UNESCAPED_UNICODE);

        $query = DB::table('investment_opportunities')
            ->where('platform_id', $platformId)
            ->where('reference_number', $row['code']);
        $this->scopeUser($query, 'investment_opportunities', $userId);

        $opportunityId = $query->value('id');

        $base = [];
        $this->setIfColumn($base, 'investment_opportunities', 'account_id', $accountId);
        $this->setIfColumn($base, 'investment_opportunities', 'platform_id', $platformId);
        $this->setIfColumn($base, 'investment_opportunities', 'title', 'تعميد - ' . $row['code']);
        $this->setIfColumn($base, 'investment_opportunities', 'reference_number', $row['code']);
        $this->setIfColumn($base, 'investment_opportunities', 'investment_type', 'ta3meed');
        $this->setIfColumn($base, 'investment_opportunities', 'principal_amount', $row['amount']);
        $this->setIfColumn($base, 'investment_opportunities', 'expected_profit_amount', $row['profit']);
        $this->setIfColumn($base, 'investment_opportunities', 'expected_rate', $row['rate']);
        $this->setIfColumn($base, 'investment_opportunities', 'start_date', null);
        $this->setIfColumn($base, 'investment_opportunities', 'maturity_date', $row['maturity_date']);
        $this->setIfColumn($base, 'investment_opportunities', 'profit_distribution', 'at_maturity');
        $this->setIfColumn($base, 'investment_opportunities', 'metadata', $metadata);
        $this->setIfColumn($base, 'investment_opportunities', 'notes', 'استيراد بيانات حساب سارة من صورة الجدول');
        $this->attachUser($base, 'investment_opportunities', $userId);

        if ($opportunityId) {
            $base['updated_at'] = now();
            DB::table('investment_opportunities')->where('id', $opportunityId)->update($base);
        } else {
            $this->setIfColumn($base, 'investment_opportunities', 'actual_profit_amount', 0);
            $this->setIfColumn($base, 'investment_opportunities', 'status', 'active');
            $this->touchForInsert($base, 'investment_opportunities');
            $opportunityId = (int) DB::table('investment_opportunities')->insertGetId($base);
        }

        $allocationQuery = DB::table('investment_opportunity_allocations')
            ->where('opportunity_id', $opportunityId)
            ->where('investor_id', $investorId);
        $this->scopeUser($allocationQuery, 'investment_opportunity_allocations', $userId);
        $allocationId = $allocationQuery->value('id');

        $allocation = [];
        $this->setIfColumn($allocation, 'investment_opportunity_allocations', 'opportunity_id', $opportunityId);
        $this->setIfColumn($allocation, 'investment_opportunity_allocations', 'investor_id', $investorId);
        $this->setIfColumn($allocation, 'investment_opportunity_allocations', 'invested_amount', $row['amount']);
        $this->setIfColumn($allocation, 'investment_opportunity_allocations', 'expected_profit_amount', $row['profit']);
        $this->attachUser($allocation, 'investment_opportunity_allocations', $userId);

        if ($allocationId) {
            $allocation['updated_at'] = now();
            DB::table('investment_opportunity_allocations')->where('id', $allocationId)->update($allocation);
        } else {
            $this->setIfColumn($allocation, 'investment_opportunity_allocations', 'actual_profit_amount', 0);
            $this->setIfColumn($allocation, 'investment_opportunity_allocations', 'received_amount', 0);
            $this->setIfColumn($allocation, 'investment_opportunity_allocations', 'status', 'active');
            $this->touchForInsert($allocation, 'investment_opportunity_allocations');
            DB::table('investment_opportunity_allocations')->insert($allocation);
        }
    }

    private function setIfColumn(array &$data, string $table, string $column, mixed $value): void
    {
        if (Schema::hasColumn($table, $column)) {
            $data[$column] = $value;
        }
    }

    private function touchForInsert(array &$data, string $table): void
    {
        if (Schema::hasColumn($table, 'created_at')) {
            $data['created_at'] = now();
        }
        if (Schema::hasColumn($table, 'updated_at')) {
            $data['updated_at'] = now();
        }
    }

    private function scopeUser($query, string $table, int $userId): void
    {
        if (Schema::hasColumn($table, 'user_id')) {
            $query->where($table . '.user_id', $userId);
        }
    }

    private function attachUser(array &$data, string $table, int $userId): void
    {
        if (Schema::hasColumn($table, 'user_id')) {
            $data['user_id'] = $userId;
        }
    }
};
