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
        $orderNo = 'L-64329-3458-010126-1';

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

        $this->deleteExistingOrderCopies($platformId, $orderNo);

        DB::table('investment_opportunities')->insert([
            'account_id' => $accountId,
            'platform_id' => $platformId,
            'title' => 'MoneyMoon D - ' . $orderNo,
            'investment_type' => 'moneymoon',
            'principal_amount' => 1750,
            'expected_profit_amount' => 70,
            'actual_profit_amount' => 0,
            'expected_rate' => 4,
            'start_date' => '2026-01-01',
            'maturity_date' => '2026-02-01',
            'status' => 'stuck',
            'profit_distribution' => 'at_maturity',
            'metadata' => json_encode([
                'category' => 'D',
                'profit_rate' => 4,
                'manual_maturity' => true,
                'external_order_no' => $orderNo,
                'source' => 'moneymoon_stuck_screenshot_2026_05_05',
                'import_key' => 'moneymoon-stuck-2026-05-05-01',
                'display_state' => 'stuck',
                'is_stuck' => true,
                'is_overdue_import' => true,
            ], JSON_UNESCAPED_UNICODE),
            'notes' => '[استيراد صورة موني مون - متعثر] الطلب: ' . $orderNo,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('investment_opportunities')) {
            return;
        }

        DB::table('investment_opportunities')
            ->where('investment_type', 'moneymoon')
            ->where('notes', 'like', '[استيراد صورة موني مون - متعثر]%')
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
