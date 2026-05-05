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
            [
                'order_no' => 'L-91673-3458-200326-1',
                'category' => 'C',
                'amount' => 1000,
                'profit' => 30,
                'rate' => 3,
                'start_date' => '2026-03-20',
                'maturity_date' => '2026-04-20',
            ],
            [
                'order_no' => 'L-85861-3458-110326-1',
                'category' => 'D',
                'amount' => 1000,
                'profit' => 40,
                'rate' => 4,
                'start_date' => '2026-03-11',
                'maturity_date' => '2026-04-11',
            ],
            [
                'order_no' => 'L-85483-3458-100326-1',
                'category' => 'C',
                'amount' => 1000,
                'profit' => 30,
                'rate' => 3,
                'start_date' => '2026-03-10',
                'maturity_date' => '2026-04-10',
            ],
            [
                'order_no' => 'L-83323-3458-040326-1',
                'category' => 'C',
                'amount' => 1500,
                'profit' => 45,
                'rate' => 3,
                'start_date' => '2026-03-04',
                'maturity_date' => '2026-04-04',
            ],
        ];

        foreach ($rows as $index => $row) {
            $this->deleteExistingOrderCopies($platformId, $row['order_no']);

            DB::table('investment_opportunities')->insert([
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
                    'source' => 'moneymoon_overdue_screenshot_2026_05_05',
                    'import_key' => 'moneymoon-overdue-2026-05-05-' . str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
                    'display_state' => 'overdue',
                    'is_overdue_import' => true,
                ], JSON_UNESCAPED_UNICODE),
                'notes' => '[استيراد صورة موني مون - متأخر] الطلب: ' . $row['order_no'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('investment_opportunities')) {
            return;
        }

        DB::table('investment_opportunities')
            ->where('investment_type', 'moneymoon')
            ->where('notes', 'like', '[استيراد صورة موني مون - متأخر]%')
            ->delete();
    }

    private function deleteExistingOrderCopies(int $platformId, string $orderNo): void
    {
        $ids = DB::table('investment_opportunities')
            ->where('platform_id', $platformId)
            ->where('investment_type', 'moneymoon')
            ->get()
            ->filter(function ($investment) use ($orderNo): bool {
                return $this->orderNumber($investment) === $orderNo;
            })
            ->pluck('id')
            ->values()
            ->all();

        if (! empty($ids)) {
            DB::table('investment_opportunities')
                ->where('platform_id', $platformId)
                ->whereIn('id', $ids)
                ->delete();
        }
    }

    private function orderNumber(object $investment): string
    {
        $metadata = [];

        if (! empty($investment->metadata)) {
            $decoded = json_decode((string) $investment->metadata, true);
            $metadata = is_array($decoded) ? $decoded : [];
        }

        foreach (['external_order_no', 'order_no', 'order_number'] as $key) {
            if (! empty($metadata[$key])) {
                return trim((string) $metadata[$key]);
            }
        }

        foreach ([$investment->title ?? '', $investment->notes ?? ''] as $value) {
            if (preg_match('/L-[A-Za-z0-9-]+/', (string) $value, $matches)) {
                return trim($matches[0]);
            }
        }

        return '';
    }
};
