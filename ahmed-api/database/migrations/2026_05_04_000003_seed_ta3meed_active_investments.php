<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $platformId = DB::table('investment_platforms')->where('code', 'ta3meed')->value('id');

        if (! $platformId) {
            $platformId = DB::table('investment_platforms')->insertGetId([
                'code' => 'ta3meed',
                'name_ar' => 'تعميد',
                'name_en' => 'Ta3meed',
                'category' => 'purchase_order_financing',
                'calculation_method' => 'custom_ta3meed',
                'description' => 'منصة تعميد',
                'settings' => json_encode(['supports_opportunities' => true], JSON_UNESCAPED_UNICODE),
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $accountId = DB::table('investment_accounts')->where('platform_id', $platformId)->value('id');

        if (! $accountId) {
            $accountId = DB::table('investment_accounts')->insertGetId([
                'platform_id' => $platformId,
                'display_name' => 'محفظة تعميد',
                'currency' => 'SAR',
                'wallet_balance' => 0,
                'total_invested_snapshot' => 0,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $rows = [
            ['code' => 'RBOI322', 'allocations' => ['أحمد' => 10000.00], 'months' => 6, 'rate' => 13.92, 'profit' => 696.00, 'class' => 'B', 'withdrawal' => '2025-04-25', 'maturity' => '2025-10-30', 'returned' => 5770.00, 'days' => -186],
            ['code' => 'ER-FFGH461', 'allocations' => ['أحمد' => 3500.00, 'أمي' => 2003.00], 'months' => 6, 'rate' => 12.48, 'profit' => 343.39, 'class' => 'A-', 'withdrawal' => '2025-10-14', 'maturity' => '2026-04-14', 'returned' => 2108.21, 'days' => -20],
            ['code' => 'ER-TIQX836', 'allocations' => ['أحمد' => 14966.00, 'أمي' => 5916.88], 'months' => 6, 'rate' => 12.00, 'profit' => 1252.98, 'class' => 'A', 'withdrawal' => '2025-11-11', 'maturity' => '2026-05-12', 'returned' => 14966.12, 'days' => 8],
            ['code' => 'ACHH476', 'allocations' => ['أحمد' => 17000.00], 'months' => 6, 'rate' => 13.54, 'profit' => 1150.56, 'class' => 'B+', 'withdrawal' => '2025-11-11', 'maturity' => '2026-05-13', 'returned' => null, 'days' => 9],
            ['code' => 'Inv-KIUR166', 'allocations' => ['أحمد' => 19908.00, 'أمل' => 13414.57, 'أمي' => 17427.81], 'months' => 6, 'rate' => 13.63, 'profit' => 3459.12, 'class' => 'B', 'withdrawal' => '2025-12-08', 'maturity' => '2026-06-07', 'returned' => null, 'days' => 34],
            ['code' => 'Inv-OJKL945', 'allocations' => ['أحمد' => 100900.00], 'months' => 6, 'rate' => 13.54, 'profit' => 6877.34, 'class' => 'B', 'withdrawal' => '2025-12-12', 'maturity' => '2026-06-14', 'returned' => null, 'days' => 41],
            ['code' => 'Inv-BUMB463', 'allocations' => ['أحمد' => 50000.00], 'months' => 6, 'rate' => 13.63, 'profit' => 3408.00, 'class' => 'B', 'withdrawal' => '2025-12-17', 'maturity' => '2026-06-21', 'returned' => null, 'days' => 48],
            ['code' => 'Inv-PJQJ560', 'allocations' => ['أحمد' => 7020.00, 'أمل' => 67148.17, 'أمي' => 6332.14], 'months' => 6, 'rate' => 13.63, 'profit' => 5486.88, 'class' => 'B', 'withdrawal' => '2025-12-23', 'maturity' => '2026-06-23', 'returned' => null, 'days' => 50],
            ['code' => 'SZUD479', 'allocations' => ['أحمد' => 71331.00], 'months' => 6, 'rate' => 13.54, 'profit' => 4827.68, 'class' => 'B+', 'withdrawal' => '2025-12-23', 'maturity' => '2026-06-25', 'returned' => null, 'days' => 52],
            ['code' => 'Inv-KSOR337', 'allocations' => ['أمي' => 17628.00], 'months' => 6, 'rate' => 13.63, 'profit' => 1201.52, 'class' => 'B', 'withdrawal' => '2025-12-25', 'maturity' => '2026-06-29', 'returned' => null, 'days' => 56],
            ['code' => 'BNMG705', 'allocations' => ['أمي' => 5363.00], 'months' => 6, 'rate' => 12.48, 'profit' => 334.65, 'class' => 'B+', 'withdrawal' => '2025-12-25', 'maturity' => '2026-06-29', 'returned' => null, 'days' => 56],
            ['code' => 'CZLK031', 'allocations' => ['أمل' => 10000.00], 'months' => 5, 'rate' => 14.02, 'profit' => 584.00, 'class' => 'B-', 'withdrawal' => '2026-02-11', 'maturity' => '2026-07-11', 'returned' => null, 'days' => 68],
            ['code' => 'AAXB965', 'allocations' => ['الوالد' => 105000.00], 'months' => 4, 'rate' => 13.536, 'profit' => 4737.60, 'class' => 'B+', 'withdrawal' => '2026-03-10', 'maturity' => '2026-07-12', 'returned' => null, 'days' => 69],
            ['code' => 'ER-EJVC884', 'allocations' => ['أمل' => 34324.00], 'months' => 6, 'rate' => 12.96, 'profit' => 2224.20, 'class' => 'B+', 'withdrawal' => '2026-01-13', 'maturity' => '2026-07-14', 'returned' => 12368.08, 'days' => 71],
            ['code' => 'SAFZ343', 'allocations' => ['أحمد' => 12060.00, 'أمل' => 29005.38], 'months' => 6, 'rate' => 13.54, 'profit' => 2779.28, 'class' => 'B+', 'withdrawal' => '2026-01-15', 'maturity' => '2026-07-19', 'returned' => null, 'days' => 76],
            ['code' => 'FEDR124', 'allocations' => ['أمل' => 2500.00, 'أمي' => 26557.64], 'months' => 6, 'rate' => 13.54, 'profit' => 1966.65, 'class' => 'B+', 'withdrawal' => '2026-01-22', 'maturity' => '2026-07-25', 'returned' => null, 'days' => 82],
            ['code' => 'ER-IRQT472', 'allocations' => ['أحمد' => 19150.00], 'months' => 6, 'rate' => 13.44, 'profit' => 1286.88, 'class' => 'B', 'withdrawal' => '2026-01-28', 'maturity' => '2026-07-28', 'returned' => 6919.52, 'days' => 85],
            ['code' => 'ER-GZGY450', 'allocations' => ['أمي' => 14644.00], 'months' => 6, 'rate' => 13.92, 'profit' => 1019.22, 'class' => 'B-', 'withdrawal' => '2026-01-29', 'maturity' => '2026-07-29', 'returned' => 5306.00, 'days' => 86],
            ['code' => 'Inv-MVIH607', 'allocations' => ['أحمد' => 200.00, 'أمي' => 12621.00], 'months' => 6, 'rate' => 12.00, 'profit' => 769.26, 'class' => 'B+', 'withdrawal' => '2026-02-01', 'maturity' => '2026-08-01', 'returned' => null, 'days' => 89],
            ['code' => 'ER-NCCT880', 'allocations' => ['أمل' => 42443.00], 'months' => 6, 'rate' => 14.40, 'profit' => 3055.90, 'class' => 'C+', 'withdrawal' => '2026-02-03', 'maturity' => '2026-08-06', 'returned' => 7774.14, 'days' => 94],
            ['code' => 'ER-BORR261', 'allocations' => ['أحمد' => 30033.00, 'أمل' => 19018.69, 'أمي' => 15947.98], 'months' => 6, 'rate' => 13.44, 'profit' => 4368.00, 'class' => 'B', 'withdrawal' => '2026-02-04', 'maturity' => '2026-08-06', 'returned' => 23547.33, 'days' => 94],
            ['code' => 'RWXU334', 'allocations' => ['الوالد' => 30000.00], 'months' => 5, 'rate' => 13.536, 'profit' => 1692.00, 'class' => 'A-', 'withdrawal' => '2026-03-31', 'maturity' => '2026-08-31', 'returned' => null, 'days' => 119],
            ['code' => 'ER-YLDJ213', 'allocations' => ['أمي' => 3736.00, 'الوالد' => 20000.00], 'months' => 6, 'rate' => 13.44, 'profit' => 1595.06, 'class' => 'B', 'withdrawal' => '2026-02-26', 'maturity' => '2026-09-06', 'returned' => null, 'days' => 125],
            ['code' => 'Inv-GFXO418', 'allocations' => ['أحمد' => 50000.00], 'months' => 6, 'rate' => 12.768, 'profit' => 3192.00, 'class' => 'B', 'withdrawal' => '2026-03-08', 'maturity' => '2026-09-08', 'returned' => null, 'days' => 127],
            ['code' => 'CBYN900', 'allocations' => ['الوالد' => 50000.00], 'months' => 6, 'rate' => 12.48, 'profit' => 3120.00, 'class' => 'B+', 'withdrawal' => '2026-03-08', 'maturity' => '2026-09-08', 'returned' => null, 'days' => 127],
            ['code' => 'Inv-XJDU700', 'allocations' => ['الوالد' => 14446.00], 'months' => 6, 'rate' => 12.768, 'profit' => 922.23, 'class' => 'B', 'withdrawal' => '2026-03-09', 'maturity' => '2026-09-11', 'returned' => null, 'days' => 130],
            ['code' => 'YEOX420', 'allocations' => ['أمل' => 4091.00, 'أمي' => 15908.65], 'months' => 7, 'rate' => 12.768, 'profit' => 1489.60, 'class' => 'A-', 'withdrawal' => '2026-02-24', 'maturity' => '2026-09-24', 'returned' => null, 'days' => 143],
            ['code' => 'ER-DQKD940', 'allocations' => ['أحمد' => 18182.00, 'أمي' => 6818.28], 'months' => 6, 'rate' => 12.48, 'profit' => 1560.00, 'class' => 'A-', 'withdrawal' => '2026-03-12', 'maturity' => '2026-10-06', 'returned' => null, 'days' => 155],
            ['code' => 'ER-ENFW796', 'allocations' => ['أمل' => 22830.00], 'months' => 6, 'rate' => 12.48, 'profit' => 1424.59, 'class' => 'A-', 'withdrawal' => '2026-03-12', 'maturity' => '2026-10-06', 'returned' => null, 'days' => 155],
            ['code' => 'ER-ROYM341', 'allocations' => ['الوالد' => 5000.00], 'months' => 6, 'rate' => 13.44, 'profit' => 336.00, 'class' => 'B', 'withdrawal' => '2026-03-31', 'maturity' => '2026-10-06', 'returned' => null, 'days' => 155],
            ['code' => 'ER-GDRM019', 'allocations' => ['الوالد' => 10000.00], 'months' => 6, 'rate' => 13.44, 'profit' => 672.00, 'class' => 'B', 'withdrawal' => '2026-03-31', 'maturity' => '2026-10-06', 'returned' => null, 'days' => 155],
            ['code' => 'Inv-YKCE217', 'allocations' => ['أمي' => 33000.00], 'months' => 6, 'rate' => 12.768, 'profit' => 2106.72, 'class' => 'B-', 'withdrawal' => '2026-04-14', 'maturity' => '2026-10-14', 'returned' => null, 'days' => 163],
            ['code' => 'TBJO945', 'allocations' => ['أحمد' => 145000.00], 'months' => 6, 'rate' => 13.536, 'profit' => 9813.60, 'class' => 'A-', 'withdrawal' => '2026-04-14', 'maturity' => '2026-10-16', 'returned' => null, 'days' => 165],
            ['code' => 'HQNY588', 'allocations' => ['أمل' => 10000.00], 'months' => 6, 'rate' => 12.48, 'profit' => 624.00, 'class' => 'B+', 'withdrawal' => '2026-04-16', 'maturity' => '2026-10-20', 'returned' => null, 'days' => 169],
            ['code' => 'ER-MFQO652', 'allocations' => ['أمل' => 9889.54, 'أمي' => 3948.46, 'الوالد' => 41162.00], 'months' => 6, 'rate' => 12.00, 'profit' => 3300.00, 'class' => 'A', 'withdrawal' => '2026-04-21', 'maturity' => '2026-11-06', 'returned' => null, 'days' => 186],
            ['code' => 'Inv-XNMW160', 'allocations' => ['الوالد' => 5000.00], 'months' => 6, 'rate' => 12.768, 'profit' => 319.20, 'class' => 'B', 'withdrawal' => '2026-04-26', 'maturity' => '2026-10-26', 'returned' => null, 'days' => 175],
            ['code' => 'LDOC207', 'allocations' => ['أحمد' => 35000.00], 'months' => 6, 'rate' => 13.44, 'profit' => 2352.00, 'class' => 'B+', 'withdrawal' => '2026-04-28', 'maturity' => '2026-10-28', 'returned' => null, 'days' => 177],
            ['code' => 'ER-JFNB916', 'allocations' => ['الوالد' => 8000.00], 'months' => 6, 'rate' => 13.44, 'profit' => 537.60, 'class' => 'B', 'withdrawal' => '2026-04-28', 'maturity' => '2026-11-06', 'returned' => null, 'days' => 186],
            ['code' => 'ER-SZQN237', 'allocations' => ['أحمد' => 14995.00], 'months' => 6, 'rate' => 14.40, 'profit' => 1079.64, 'class' => 'C+', 'withdrawal' => '2026-05-03', 'maturity' => '2026-11-06', 'returned' => null, 'days' => 186],
            ['code' => 'ER-TSAQ263', 'allocations' => ['أحمد' => 25005.00], 'months' => 6, 'rate' => 14.40, 'profit' => 1800.36, 'class' => 'C+', 'withdrawal' => '2026-05-03', 'maturity' => '2026-11-06', 'returned' => null, 'days' => 186],
        ];

        foreach ($rows as $row) {
            $allocations = array_filter($row['allocations'], fn ($amount) => (float) $amount > 0);
            $totalAmount = round(array_sum($allocations), 2);
            $profit = round((float) $row['profit'], 2);
            $metadata = [
                'category' => $row['class'],
                'months' => $row['months'],
                'withdrawal_date' => $row['withdrawal'],
                'returned_amount' => $row['returned'],
                'remaining_days' => $row['days'],
                'is_overdue' => $row['days'] < 0,
                'source' => 'ta3meed_active_excel_screenshots',
            ];

            $opportunityId = DB::table('investment_opportunities')
                ->where('platform_id', $platformId)
                ->where('reference_number', $row['code'])
                ->value('id');

            $opportunityData = [
                'account_id' => $accountId,
                'platform_id' => $platformId,
                'title' => 'تعميد - ' . $row['code'],
                'reference_number' => $row['code'],
                'investment_type' => 'ta3meed',
                'principal_amount' => $totalAmount,
                'expected_profit_amount' => $profit,
                'actual_profit_amount' => 0,
                'expected_rate' => $row['rate'],
                'start_date' => $row['withdrawal'],
                'maturity_date' => $row['maturity'],
                'status' => 'active',
                'profit_distribution' => 'at_maturity',
                'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE),
                'notes' => 'مدخل من صور إكسل تعميد - الاستثمارات النشطة',
                'updated_at' => $now,
            ];

            if ($opportunityId) {
                DB::table('investment_opportunities')->where('id', $opportunityId)->update($opportunityData);
                DB::table('investment_opportunity_allocations')->where('opportunity_id', $opportunityId)->delete();
            } else {
                $opportunityData['created_at'] = $now;
                $opportunityId = DB::table('investment_opportunities')->insertGetId($opportunityData);
            }

            foreach ($allocations as $investorName => $amount) {
                $investorId = $this->investorId($investorName, $now);
                $amount = round((float) $amount, 2);
                $allocationProfit = $totalAmount > 0 ? round($profit * ($amount / $totalAmount), 2) : 0;

                DB::table('investment_opportunity_allocations')->insert([
                    'opportunity_id' => $opportunityId,
                    'investor_id' => $investorId,
                    'invested_amount' => $amount,
                    'expected_profit_amount' => $allocationProfit,
                    'actual_profit_amount' => 0,
                    'received_amount' => 0,
                    'status' => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        $codes = [
            'RBOI322', 'ER-FFGH461', 'ER-TIQX836', 'ACHH476', 'Inv-KIUR166', 'Inv-OJKL945', 'Inv-BUMB463', 'Inv-PJQJ560', 'SZUD479', 'Inv-KSOR337', 'BNMG705', 'CZLK031', 'AAXB965', 'ER-EJVC884', 'SAFZ343', 'FEDR124', 'ER-IRQT472', 'ER-GZGY450', 'Inv-MVIH607', 'ER-NCCT880', 'ER-BORR261', 'RWXU334', 'ER-YLDJ213', 'Inv-GFXO418', 'CBYN900', 'Inv-XJDU700', 'YEOX420', 'ER-DQKD940', 'ER-ENFW796', 'ER-ROYM341', 'ER-GDRM019', 'Inv-YKCE217', 'TBJO945', 'HQNY588', 'ER-MFQO652', 'Inv-XNMW160', 'LDOC207', 'ER-JFNB916', 'ER-SZQN237', 'ER-TSAQ263',
        ];

        $ids = DB::table('investment_opportunities')->whereIn('reference_number', $codes)->pluck('id');
        DB::table('investment_opportunity_allocations')->whereIn('opportunity_id', $ids)->delete();
        DB::table('investment_opportunities')->whereIn('id', $ids)->delete();
    }

    private function investorId(string $name, $now): int
    {
        $codes = [
            'أحمد' => 'ahmed',
            'سارة' => 'sara',
            'أمل' => 'amal',
            'أمي' => 'mother',
            'الوالد' => 'father',
        ];

        $code = $codes[$name] ?? strtolower(trim(str_replace(' ', '_', $name)));
        $id = DB::table('investment_investors')->where('code', $code)->value('id');

        if ($id) {
            return (int) $id;
        }

        return DB::table('investment_investors')->insertGetId([
            'code' => $code,
            'name' => $name,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
};
