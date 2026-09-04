<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SOURCE = 'dinar_statement_screenshots_2026_09_04_oldest';

    public function up(): void
    {
        if (
            ! Schema::hasTable('users')
            || ! Schema::hasTable('dinar_account_transactions')
            || ! Schema::hasTable('dinar_payments')
        ) {
            return;
        }

        $userId = $this->ahmedUserId();
        if (! $userId) {
            return;
        }

        DB::transaction(function () use ($userId) {
            $this->importVisibleTransactions($userId);
            $this->importHistoricalProfitPayments($userId);
            $this->assertImport($userId);
        });
    }

    public function down(): void
    {
        // Financial evidence is intentionally retained during rollback.
    }

    private function importVisibleTransactions(int $userId): void
    {
        // Exact rows visible in the four supplied Dinar account screenshots.
        // The ledger stores monetary values to two decimals. The one source row
        // displayed as 2,002.264 is therefore stored as 2,002.26, while its exact
        // source value is retained in the notes.
        $rows = [
            // date, type, title, signed amount, source amount text
            ['2024-12-17', 'distribution', 'توزيعات دورية', 8.88, null],
            ['2024-12-17', 'management_fee', 'رسوم إدارة', 0.00, null],
            ['2024-12-17', 'vat', 'ضريبة القيمة المضافة على رسوم الإدارة', 0.00, null],

            ['2024-12-20', 'bank_deposit', 'إيداع بنكي', 5000.00, null],
            ['2024-12-20', 'bank_deposit', 'إيداع بنكي', 5000.00, null],
            ['2024-12-20', 'bank_deposit', 'إيداع بنكي', 500.00, null],
            ['2024-12-20', 'unit_order', 'طلب وحدات استثمارية', -12000.00, null],

            ['2024-12-23', 'bank_deposit', 'إيداع بنكي', 2500.00, null],
            ['2024-12-23', 'unit_order', 'طلب وحدات استثمارية', -3000.00, null],
            ['2024-12-23', 'bank_withdrawal', 'سحب بنكي', -8.00, null],

            ['2024-12-30', 'principal_return', 'القيمة الاسمية', 12000.00, null],
            ['2024-12-30', 'distribution', 'توزيعات دورية', 13.80, null],
            ['2024-12-30', 'management_fee', 'رسوم إدارة', 0.00, null],
            ['2024-12-30', 'vat', 'ضريبة القيمة المضافة على رسوم الإدارة', 0.00, null],
            ['2024-12-30', 'bank_withdrawal', 'سحب بنكي', -14.68, null],
            ['2024-12-30', 'bank_withdrawal', 'سحب بنكي', -10000.00, null],

            ['2024-12-31', 'principal_return', 'القيمة الاسمية', 3000.00, null],
            ['2024-12-31', 'distribution', 'توزيعات دورية', 3.00, null],
            ['2024-12-31', 'management_fee', 'رسوم إدارة', 0.00, null],
            ['2024-12-31', 'vat', 'ضريبة القيمة المضافة على رسوم الإدارة', 0.00, null],

            ['2025-01-01', 'bank_withdrawal', 'سحب بنكي', -5003.00, null],

            ['2025-07-06', 'bank_deposit', 'إيداع بنكي', 1000.00, null],
            ['2025-07-06', 'unit_order', 'طلب وحدات', -1000.00, null],
            ['2025-07-06', 'bank_deposit', 'إيداع بنكي', 1000.00, null],
            ['2025-07-06', 'unit_order', 'طلب وحدات', -1000.00, null],

            ['2025-07-08', 'bank_deposit', 'إيداع بنكي', 5000.00, null],
            ['2025-07-08', 'sukuk_order', 'طلب صكوك', -5000.00, null],

            ['2025-07-16', 'subscription_refund', 'استرداد طلب اشتراك', 2002.26, '2002.264'],
            ['2025-07-16', 'sukuk_order', 'طلب صكوك', -2000.00, null],
            ['2025-07-16', 'sukuk_redemption', 'استرجاع صكوك', 2000.00, null],
            ['2025-07-16', 'sukuk_order', 'طلب صكوك', -2000.00, null],
            ['2025-07-16', 'sukuk_redemption', 'استرجاع صكوك', 2000.00, null],
            ['2025-07-16', 'sukuk_order', 'طلب صكوك', -2000.00, null],
            ['2025-07-16', 'sukuk_redemption', 'استرجاع صكوك', 2000.00, null],
            ['2025-07-16', 'sukuk_order', 'طلب صكوك', -2000.00, null],
            ['2025-07-16', 'bank_withdrawal', 'سحب بنكي', -2.00, null],
            ['2025-07-16', 'bank_withdrawal', 'سحب بنكي', -2000.26, null],
        ];

        foreach ($rows as $index => [$date, $type, $title, $amount, $sourceAmount]) {
            $sourceKey = implode('|', [
                self::SOURCE,
                str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
                $date,
                $type,
                number_format((float) $amount, 2, '.', ''),
            ]);

            $notes = 'مستورد من سجل العمليات التاريخي لمنصة دينار المرسل بتاريخ 2026-09-04.';
            if ($sourceAmount !== null) {
                $notes .= ' القيمة الظاهرة حرفيًا في المصدر: ' . $sourceAmount . ' ريال.';
            }

            DB::table('dinar_account_transactions')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'source_key' => $sourceKey,
                ],
                [
                    'dinar_investment_id' => null,
                    'transaction_date' => $date,
                    'transaction_type' => $type,
                    'title' => $title,
                    'signed_amount' => $amount,
                    'source' => self::SOURCE,
                    'notes' => $notes,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function importHistoricalProfitPayments(int $userId): void
    {
        // These three distributions are explicit realized profit in the statement.
        // They are intentionally imported without principal because their old
        // opportunities are not part of the current 97,000 original-capital set.
        $payments = [
            ['2024-12-17', 8.88],
            ['2024-12-30', 13.80],
            ['2024-12-31', 3.00],
        ];

        foreach ($payments as [$date, $gross]) {
            DB::table('dinar_payments')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'statement_key' => self::SOURCE . '|historical-profit|' . $date . '|' . number_format($gross, 2, '.', ''),
                ],
                [
                    'dinar_investment_id' => null,
                    'installment_no' => null,
                    'due_date' => $date,
                    'distribution_per_unit' => 0,
                    'principal_per_unit' => 0,
                    'total_distribution' => $gross,
                    'total_principal' => 0,
                    'is_paid' => true,
                    'paid_at' => $date,
                    'paid_amount' => $gross,
                    'investment_fee' => 0,
                    'vat_amount' => 0,
                    'net_distribution' => $gross,
                    'statement_verified' => true,
                    'title' => 'توزيع تاريخي من كشف دينار - ' . $date,
                    'notes' => 'توزيع دوري تاريخي مثبت في كشف دينار؛ لا يؤثر على رأس المال القائم الحالي.',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function assertImport(int $userId): void
    {
        $query = DB::table('dinar_account_transactions')
            ->where('user_id', $userId)
            ->where('source', self::SOURCE);

        $actual = [
            'count' => (int) (clone $query)->count(),
            'deposits' => round((float) (clone $query)->where('transaction_type', 'bank_deposit')->sum('signed_amount'), 2),
            'unit_orders' => round(abs((float) (clone $query)->where('transaction_type', 'unit_order')->sum('signed_amount')), 2),
            'sukuk_orders' => round(abs((float) (clone $query)->where('transaction_type', 'sukuk_order')->sum('signed_amount')), 2),
            'redemptions' => round((float) (clone $query)->where('transaction_type', 'sukuk_redemption')->sum('signed_amount'), 2),
            'principal' => round((float) (clone $query)->where('transaction_type', 'principal_return')->sum('signed_amount'), 2),
            'distributions' => round((float) (clone $query)->where('transaction_type', 'distribution')->sum('signed_amount'), 2),
            'withdrawals' => round(abs((float) (clone $query)->where('transaction_type', 'bank_withdrawal')->sum('signed_amount')), 2),
        ];

        $expected = [
            'count' => 37,
            'deposits' => 20000.00,
            'unit_orders' => 17000.00,
            'sukuk_orders' => 13000.00,
            'redemptions' => 6000.00,
            'principal' => 15000.00,
            'distributions' => 25.68,
            'withdrawals' => 17027.94,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException('Oldest Dinar statement import failed: ' . json_encode($actual));
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
