<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SOURCE = 'dinar_statement_screenshots_2026_09_04_earliest';
    private const OLDER_SOURCE = 'dinar_statement_screenshots_2026_09_04_older';

    public function up(): void
    {
        if (
            ! Schema::hasTable('users')
            || ! Schema::hasTable('dinar_investments')
            || ! Schema::hasTable('dinar_payments')
            || ! Schema::hasTable('dinar_account_transactions')
        ) {
            return;
        }

        foreach (['investment_fee', 'vat_amount', 'net_distribution', 'statement_verified', 'statement_key'] as $column) {
            if (! Schema::hasColumn('dinar_payments', $column)) {
                return;
            }
        }

        $userId = $this->ahmedUserId();
        if (! $userId) {
            return;
        }

        DB::transaction(function () use ($userId) {
            $this->reconcileJanuaryDistribution($userId);
            $this->importVisibleTransactions($userId);
            $this->assertImportedTransactions($userId);
            $this->assertCashContinuity($userId);
        });
    }

    public function down(): void
    {
        // Financial evidence is intentionally retained during rollback.
    }

    private function reconcileJanuaryDistribution(int $userId): void
    {
        $investmentId = (int) (DB::table('dinar_investments')
            ->where('user_id', $userId)
            ->where('external_key', '0116-162')
            ->value('id') ?: 0);

        if ($investmentId <= 0) {
            return;
        }

        // Statement rows on 2026-01-27 prove the gross 383.50 distribution was
        // reduced by 25.21 investment fee and 3.79 VAT, leaving 354.50 net.
        // That exact 354.50 was later withdrawn on 2026-02-05.
        $payment = DB::table('dinar_payments')
            ->where('user_id', $userId)
            ->where('dinar_investment_id', $investmentId)
            ->where('total_distribution', 383.50)
            ->orderBy('installment_no')
            ->first();

        if (! $payment) {
            return;
        }

        DB::table('dinar_payments')
            ->where('id', $payment->id)
            ->update([
                'is_paid' => true,
                'paid_at' => '2026-01-27',
                'paid_amount' => 383.50,
                'investment_fee' => 25.21,
                'vat_amount' => 3.79,
                'net_distribution' => 354.50,
                'statement_verified' => true,
                'statement_key' => self::SOURCE . '|0116-162|2026-01-27',
                'notes' => 'مطابق لسجل دينار: 383.50 - 25.21 رسوم - 3.79 ضريبة = 354.50 صافي، وهو نفس السحب البنكي بتاريخ 2026-02-05.',
                'updated_at' => now(),
            ]);
    }

    private function importVisibleTransactions(int $userId): void
    {
        $rows = [
            // date, type, title, signed amount, occurrence on same date/type/amount
            ['2025-07-20', 'bank_deposit', 'إيداع بنكي', 5000.00, 1],
            ['2025-07-20', 'sukuk_order', 'طلب صكوك', -5000.00, 1],

            ['2026-01-27', 'distribution', 'توزيعات دورية', 383.50, 1],
            ['2026-01-27', 'investment_fee', 'رسوم استثمار', -25.21, 1],
            ['2026-01-27', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -3.79, 1],
            ['2026-02-05', 'bank_withdrawal', 'سحب بنكي', -354.50, 1],

            ['2026-02-12', 'bank_deposit', 'إيداع بنكي', 8000.00, 1],
            ['2026-02-12', 'bank_deposit', 'إيداع بنكي', 2000.00, 1],
            ['2026-02-12', 'sukuk_order', 'طلب صكوك', -10000.00, 1],

            ['2026-02-23', 'bank_deposit', 'إيداع بنكي', 5000.00, 1],
            ['2026-02-23', 'sukuk_order', 'طلب صكوك', -5000.00, 1],
            ['2026-02-23', 'bank_deposit', 'إيداع بنكي', 1000.00, 1],
            ['2026-02-23', 'sukuk_order', 'طلب صكوك', -1000.00, 1],
            ['2026-02-23', 'bank_deposit', 'إيداع بنكي', 5000.00, 2],
            ['2026-02-23', 'sukuk_order', 'طلب صكوك', -5000.00, 2],

            ['2026-02-24', 'bank_deposit', 'إيداع بنكي', 1000.00, 1],
            ['2026-02-24', 'sukuk_order', 'طلب صكوك', -2000.00, 1],
            ['2026-02-24', 'bank_deposit', 'إيداع بنكي', 1000.00, 2],
            ['2026-02-24', 'sukuk_order', 'طلب صكوك', -1000.00, 1],
            ['2026-02-24', 'bank_deposit', 'إيداع بنكي', 1000.00, 3],
            ['2026-02-24', 'bank_deposit', 'إيداع بنكي', 5000.00, 1],
            ['2026-02-24', 'sukuk_order', 'طلب صكوك', -5000.00, 1],

            ['2026-02-25', 'bank_deposit', 'إيداع بنكي', 10000.00, 1],
            ['2026-02-25', 'sukuk_order', 'طلب صكوك', -10000.00, 1],

            ['2026-02-26', 'card_deposit', 'إيداع بالبطاقة', 1000.00, 1],
            ['2026-02-26', 'sukuk_order', 'طلب صكوك', -1000.00, 1],

            ['2026-03-03', 'bank_deposit', 'إيداع بنكي', 39000.00, 1],
        ];

        foreach ($rows as [$date, $type, $title, $amount, $occurrence]) {
            $sourceKey = implode('|', [
                self::SOURCE,
                $date,
                $type,
                number_format((float) $amount, 2, '.', ''),
                (string) $occurrence,
            ]);

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
                    'notes' => 'مستورد من سجل العمليات الأقدم لمنصة دينار المرسل بتاريخ 2026-09-04.',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function assertImportedTransactions(int $userId): void
    {
        $query = DB::table('dinar_account_transactions')
            ->where('user_id', $userId)
            ->where('source', self::SOURCE);

        $depositTypes = ['bank_deposit', 'card_deposit'];

        $actual = [
            'count' => (int) (clone $query)->count(),
            'deposits' => round((float) (clone $query)
                ->whereIn('transaction_type', $depositTypes)
                ->sum('signed_amount'), 2),
            'orders' => round(abs((float) (clone $query)
                ->where('transaction_type', 'sukuk_order')
                ->sum('signed_amount')), 2),
            'distributions' => round((float) (clone $query)
                ->where('transaction_type', 'distribution')
                ->sum('signed_amount'), 2),
            'fees' => round(abs((float) (clone $query)
                ->where('transaction_type', 'investment_fee')
                ->sum('signed_amount')), 2),
            'vat' => round(abs((float) (clone $query)
                ->where('transaction_type', 'vat')
                ->sum('signed_amount')), 2),
            'withdrawals' => round(abs((float) (clone $query)
                ->where('transaction_type', 'bank_withdrawal')
                ->sum('signed_amount')), 2),
            'net' => round((float) (clone $query)->sum('signed_amount'), 2),
        ];

        $expected = [
            'count' => 27,
            'deposits' => 84000.00,
            'orders' => 45000.00,
            'distributions' => 383.50,
            'fees' => 25.21,
            'vat' => 3.79,
            'withdrawals' => 354.50,
            'net' => 39000.00,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException('Earliest Dinar statement import failed: ' . json_encode($actual));
        }
    }

    private function assertCashContinuity(int $userId): void
    {
        // The newly visible 39,000 deposit on 3 March resolves the previously
        // inferred opening balance. Combining it with the already imported 4-5 March
        // rows must reconcile the wallet back to zero after the 70,000 withdrawal.
        $earliestNet = round((float) DB::table('dinar_account_transactions')
            ->where('user_id', $userId)
            ->where('source', self::SOURCE)
            ->sum('signed_amount'), 2);

        $marchNet = round((float) DB::table('dinar_account_transactions')
            ->where('user_id', $userId)
            ->where('source', self::OLDER_SOURCE)
            ->whereBetween('transaction_date', ['2026-03-04', '2026-03-05'])
            ->sum('signed_amount'), 2);

        if (round($earliestNet + $marchNet, 2) !== 0.00) {
            throw new RuntimeException('Dinar March cash continuity check failed: ' . json_encode([
                'through_2026_03_03' => $earliestNet,
                'march_04_05' => $marchNet,
                'combined' => round($earliestNet + $marchNet, 2),
            ]));
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
