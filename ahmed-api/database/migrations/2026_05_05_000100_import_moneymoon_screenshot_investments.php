<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('investment_platforms') || ! Schema::hasTable('investment_accounts') || ! Schema::hasTable('investment_opportunities')) {
            return;
        }

        $now = now();

        DB::table('investment_platforms')->updateOrInsert(
            ['code' => 'moneymoon'],
            [
                'name_ar' => 'موني مون',
                'name_en' => 'MoneyMoon',
                'category' => 'investment',
                'calculation_method' => 'fixed_rate_by_category',
                'description' => 'استثمارات منصة موني مون',
                'settings' => json_encode([
                    'profit_rates' => [
                        'A' => 2,
                        'B' => 2,
                        'C' => 3,
                        'D' => 4,
                    ],
                ], JSON_UNESCAPED_UNICODE),
                'is_active' => true,
                'updated_at' => $now,
            ]
        );

        $platformId = DB::table('investment_platforms')->where('code', 'moneymoon')->value('id');

        if (! $platformId) {
            return;
        }

        $accountId = DB::table('investment_accounts')
            ->where('platform_id', $platformId)
            ->value('id');

        if (! $accountId) {
            $accountId = DB::table('investment_accounts')->insertGetId([
                'platform_id' => $platformId,
                'display_name' => 'MoneyMoon Wallet',
                'currency' => 'SAR',
                'wallet_balance' => 0,
                'total_invested_snapshot' => 0,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $rows = [
            ['seq' => 1, 'order_no' => 'L-104743-3458-160426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-16', 'maturity_date' => '2026-05-17'],
            ['seq' => 2, 'order_no' => 'L-103747-3458-140426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-14', 'maturity_date' => '2026-05-15'],
            ['seq' => 3, 'order_no' => 'L-103747-3458-140426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-14', 'maturity_date' => '2026-05-15'],
            ['seq' => 4, 'order_no' => 'L-103738-3458-140426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-14', 'maturity_date' => '2026-05-15'],
            ['seq' => 5, 'order_no' => 'L-103738-3458-140426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-14', 'maturity_date' => '2026-05-15'],
            ['seq' => 6, 'order_no' => 'L-103738-3458-140426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-14', 'maturity_date' => '2026-05-15'],
            ['seq' => 7, 'order_no' => 'L-103717-3458-140426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-14', 'maturity_date' => '2026-05-15'],
            ['seq' => 8, 'order_no' => 'L-103717-3458-140426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-14', 'maturity_date' => '2026-05-15'],
            ['seq' => 9, 'order_no' => 'L-103717-3458-140426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-14', 'maturity_date' => '2026-05-15'],
            ['seq' => 10, 'order_no' => 'L-103399-3458-130426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-13', 'maturity_date' => '2026-05-15'],
            ['seq' => 11, 'order_no' => 'L-103399-3458-130426-1', 'category' => 'C', 'amount' => 1100, 'profit' => 33, 'rate' => 3, 'start_date' => '2026-04-13', 'maturity_date' => '2026-05-14'],
            ['seq' => 12, 'order_no' => 'L-103399-3458-130426-1', 'category' => 'C', 'amount' => 1100, 'profit' => 33, 'rate' => 3, 'start_date' => '2026-04-13', 'maturity_date' => '2026-05-14'],
            ['seq' => 13, 'order_no' => 'L-103306-3458-130426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-13', 'maturity_date' => '2026-05-14'],
            ['seq' => 14, 'order_no' => 'L-103306-3458-130426-1', 'category' => 'C', 'amount' => 1100, 'profit' => 33, 'rate' => 3, 'start_date' => '2026-04-13', 'maturity_date' => '2026-05-14'],
            ['seq' => 15, 'order_no' => 'L-103306-3458-130426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-13', 'maturity_date' => '2026-05-14'],
            ['seq' => 16, 'order_no' => 'L-103306-3458-130426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-13', 'maturity_date' => '2026-05-14'],
            ['seq' => 17, 'order_no' => 'L-102803-3458-120426-1', 'category' => 'C', 'amount' => 1000, 'profit' => 30, 'rate' => 3, 'start_date' => '2026-04-12', 'maturity_date' => '2026-05-13'],
            ['seq' => 18, 'order_no' => 'L-100526-3458-050426-1', 'category' => 'D', 'amount' => 1000, 'profit' => 40, 'rate' => 4, 'start_date' => '2026-04-05', 'maturity_date' => '2026-05-06'],
        ];

        foreach (array_reverse($rows) as $row) {
            $importKey = 'moneymoon-image-2026-05-05-' . str_pad((string) $row['seq'], 2, '0', STR_PAD_LEFT);
            $notes = '[استيراد صورة موني مون 2026-05-05 #' . str_pad((string) $row['seq'], 2, '0', STR_PAD_LEFT) . '] الطلب: ' . $row['order_no'];

            $payload = [
                'account_id' => $accountId,
                'platform_id' => $platformId,
                'title' => 'MoneyMoon ' . $row['category'] . ' - ' . $row['order_no'],
                'investment_type' => 'moneymoon',
                'principal_amount' => $row['amount'],
                'expected_profit_amount' => $row['profit'],
                'actual_profit_amount' => 0,
                'expected_rate' => $row['rate'],
                'start_date' => $row['start_date'],
                'maturity_date' => $row['maturity_date'],
                'status' => 'active',
                'profit_distribution' => 'at_maturity',
                'metadata' => json_encode([
                    'category' => $row['category'],
                    'profit_rate' => $row['rate'],
                    'manual_maturity' => true,
                    'external_order_no' => $row['order_no'],
                    'source' => 'moneymoon_screenshot_2026_05_05',
                    'import_key' => $importKey,
                    'image_sequence' => $row['seq'],
                ], JSON_UNESCAPED_UNICODE),
                'notes' => $notes,
                'updated_at' => $now,
            ];

            $existingId = DB::table('investment_opportunities')
                ->where('platform_id', $platformId)
                ->where('notes', $notes)
                ->value('id');

            if ($existingId) {
                DB::table('investment_opportunities')->where('id', $existingId)->update($payload);
            } else {
                DB::table('investment_opportunities')->insert($payload + ['created_at' => $now]);
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('investment_opportunities')) {
            return;
        }

        DB::table('investment_opportunities')
            ->where('investment_type', 'moneymoon')
            ->where('notes', 'like', '[استيراد صورة موني مون 2026-05-05 #%')
            ->delete();
    }
};
