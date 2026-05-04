<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class InvestmentPlatformSeeder extends Seeder
{
    /**
     * Seed the initial supported investment platforms.
     */
    public function run(): void
    {
        $platforms = [
            [
                'code' => 'ta3meed',
                'name_ar' => 'تعميد',
                'name_en' => 'Ta3meed',
                'category' => 'purchase_order_financing',
                'calculation_method' => 'custom_ta3meed',
                'description' => 'منصة استثمار لها طريقة احتساب خاصة يتم ضبطها لاحقًا حسب شرح آلية الفرص والأرباح.',
                'settings' => [
                    'supports_opportunities' => true,
                    'default_profit_distribution' => 'at_maturity',
                    'has_internal_wallet' => true,
                ],
            ],
            [
                'code' => 'dinar',
                'name_ar' => 'دينار',
                'name_en' => 'Dinar',
                'category' => 'sukuk_and_products',
                'calculation_method' => 'custom_dinar',
                'description' => 'منصة استثمار لها منتجات وفرص متعددة، وسيتم تخصيص طريقة الحساب لاحقًا.',
                'settings' => [
                    'supports_opportunities' => true,
                    'default_profit_distribution' => 'custom',
                    'has_internal_wallet' => true,
                ],
            ],
            [
                'code' => 'tarmeez',
                'name_ar' => 'ترميز',
                'name_en' => 'Tarmeez',
                'category' => 'company_financing',
                'calculation_method' => 'custom_tarmeez',
                'description' => 'منصة استثمار وتمويل شركات، وسيتم ضبط العوائد والحالات حسب آلية المنصة.',
                'settings' => [
                    'supports_opportunities' => true,
                    'default_profit_distribution' => 'at_maturity',
                    'has_internal_wallet' => true,
                ],
            ],
            [
                'code' => 'moneymoon',
                'name_ar' => 'موني مون',
                'name_en' => 'MoneyMoon',
                'category' => 'p2p_financing',
                'calculation_method' => 'custom_moneymoon',
                'description' => 'منصة استثمار بأسلوب مستقل في احتساب المبالغ والأرباح، وسيتم تخصيصها لاحقًا.',
                'settings' => [
                    'supports_opportunities' => true,
                    'default_profit_distribution' => 'custom',
                    'has_internal_wallet' => true,
                ],
            ],
        ];

        foreach ($platforms as $platform) {
            DB::table('investment_platforms')->updateOrInsert(
                ['code' => $platform['code']],
                [
                    'name_ar' => $platform['name_ar'],
                    'name_en' => $platform['name_en'],
                    'category' => $platform['category'],
                    'calculation_method' => $platform['calculation_method'],
                    'description' => $platform['description'],
                    'settings' => json_encode($platform['settings'], JSON_UNESCAPED_UNICODE),
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
