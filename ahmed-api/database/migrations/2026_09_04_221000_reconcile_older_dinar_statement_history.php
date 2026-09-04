<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SOURCE = 'dinar_statement_screenshots_2026_09_04_older';
    private const PREVIOUS_SOURCE = 'dinar_statement_screenshots_2026_09_04';

    public function up(): void
    {
        if (
            ! Schema::hasTable('users')
            || ! Schema::hasTable('dinar_payments')
            || ! Schema::hasTable('dinar_investments')
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
            $investmentIds = DB::table('dinar_investments')
                ->where('user_id', $userId)
                ->whereIn('external_key', [
                    'mohammed-al-taleb',
                    'alkarama',
                    'almahatta',
                    'kifah-12m',
                    'kifah-6m',
                    'asloob',
                    'gulf-gate',
                    'alameen',
                    '0116-162',
                ])
                ->pluck('id', 'external_key');

            $this->reconcileLinkedPayments($userId, $investmentIds);
            $this->correctLegacyUnlinkedPayments($userId);
            $this->linkPreviouslyImportedRows($userId, $investmentIds);
            $this->importVisibleTransactions($userId, $investmentIds);
            $this->assertImportedTransactions($userId);
        });
    }

    public function down(): void
    {
        // Financial evidence is intentionally retained during rollback.
    }

    private function reconcileLinkedPayments(int $userId, $investmentIds): void
    {
        $rows = [
            // key, gross distribution, paid_at, investment fee, VAT, net distribution
            ['0116-162', 191.75, '2026-04-27', 12.33, 1.85, 177.57],
            ['alameen', 402.00, '2026-05-19', 24.38, 3.66, 373.96],
            ['kifah-6m', 194.25, '2026-06-02', 12.60, 1.89, 179.76],
            ['gulf-gate', 235.20, '2026-06-02', 15.12, 2.27, 217.81],
            ['kifah-12m', 400.00, '2026-06-03', 25.21, 3.79, 371.00],
            ['asloob', 195.00, '2026-06-04', 12.60, 1.89, 180.51],
            ['almahatta', 41.90, '2026-06-05', 2.52, 0.38, 39.00],
            ['alkarama', 1031.25, '2026-06-11', 63.01, 9.46, 958.78],
            ['mohammed-al-taleb', 968.75, '2026-06-11', 63.01, 9.46, 896.28],
        ];

        foreach ($rows as [$key, $gross, $paidAt, $fee, $vat, $net]) {
            $investmentId = (int) ($investmentIds[$key] ?? 0);
            if ($investmentId <= 0) {
                continue;
            }

            $payment = DB::table('dinar_payments')
                ->where('user_id', $userId)
                ->where('dinar_investment_id', $investmentId)
                ->where('total_distribution', $gross)
                ->orderBy('installment_no')
                ->first();

            if (! $payment) {
                continue;
            }

            DB::table('dinar_payments')
                ->where('id', $payment->id)
                ->update([
                    'is_paid' => true,
                    'paid_at' => $paidAt,
                    'paid_amount' => $gross,
                    'investment_fee' => $fee,
                    'vat_amount' => $vat,
                    'net_distribution' => $net,
                    'statement_verified' => true,
                    'statement_key' => self::SOURCE . '|' . $key . '|' . $paidAt,
                    'notes' => 'تمت المطابقة مع سجل عمليات دينار المرسل بتاريخ 2026-09-04: إجمالي التوزيع ناقص رسوم الاستثمار والضريبة يساوي صافي الربح.',
                    'updated_at' => now(),
                ]);
        }
    }

    private function correctLegacyUnlinkedPayments(int $userId): void
    {
        // This legacy seed stored 1,038.20 as one profit distribution. The statement
        // proves it was 1,000.00 principal + 38.20 gross distribution, with 2.55 fee
        // and 0.39 VAT. Correcting it prevents a 1,000 SAR overstatement of profit.
        $legacy1038 = DB::table('dinar_payments')
            ->where('user_id', $userId)
            ->whereNull('dinar_investment_id')
            ->whereDate('due_date', '2026-06-03')
            ->where(function ($query) {
                $query->where('paid_amount', 1038.20)
                    ->orWhere('total_distribution', 1038.20);
            })
            ->first();

        if ($legacy1038) {
            DB::table('dinar_payments')
                ->where('id', $legacy1038->id)
                ->update([
                    'total_distribution' => 38.20,
                    'total_principal' => 1000.00,
                    'is_paid' => true,
                    'paid_at' => '2026-06-03',
                    'paid_amount' => 38.20,
                    'investment_fee' => 2.55,
                    'vat_amount' => 0.39,
                    'net_distribution' => 35.26,
                    'statement_verified' => true,
                    'statement_key' => self::SOURCE . '|unlinked-principal|2026-06-03',
                    'title' => 'فرصة دينار سابقة غير محددة - 3 يونيو 2026',
                    'notes' => 'القيمة الاسمية 1,000 + توزيع 38.20 - رسوم 2.55 - ضريبة 0.39. لم تُربط بفرصة حالية حتى لا يُخصم رأس المال من فرصة غير مؤكدة.',
                    'updated_at' => now(),
                ]);
        }

        // The old seed also contained a 2,067.00 unlinked profit row on 3 June.
        // The now-complete statement sequence for 19 May through 4 June reconciles
        // exactly to the 2,177.79 bank withdrawal without this row, proving it was
        // a duplicate/misread seed rather than an additional distribution.
        DB::table('dinar_payments')
            ->where('user_id', $userId)
            ->whereNull('dinar_investment_id')
            ->whereDate('due_date', '2026-06-03')
            ->where('total_distribution', 2067.00)
            ->where('title', 'صكوك شركة محمد وباسم أبناء ياسين الغدير وشركاه')
            ->delete();
    }

    private function linkPreviouslyImportedRows(int $userId, $investmentIds): void
    {
        $mohammedId = (int) ($investmentIds['mohammed-al-taleb'] ?? 0);
        if ($mohammedId > 0) {
            // Previous screenshot showed this fee and the matching 896.28 withdrawal;
            // the new screenshots provide the missing 968.75 distribution and 9.46 VAT.
            DB::table('dinar_account_transactions')
                ->where('user_id', $userId)
                ->where('source', self::PREVIOUS_SOURCE)
                ->whereDate('transaction_date', '2026-06-11')
                ->where('transaction_type', 'investment_fee')
                ->where('signed_amount', -63.01)
                ->update([
                    'dinar_investment_id' => $mohammedId,
                    'notes' => 'رسوم استثمار مرتبطة بتوزيع محمد عبدالله آل طالب 968.75؛ تم تأكيد الربط من الصور الإضافية.',
                    'updated_at' => now(),
                ]);
        }
    }

    private function importVisibleTransactions(int $userId, $investmentIds): void
    {
        $rows = [
            // date, type, title, signed amount, investment key (when confirmed)
            ['2026-03-04', 'bank_deposit', 'إيداع بنكي', 4500.00, null],
            ['2026-03-04', 'bank_deposit', 'إيداع بنكي', 58500.00, null],
            ['2026-03-04', 'bank_deposit', 'إيداع بنكي', 3000.00, null],
            ['2026-03-04', 'bank_deposit', 'إيداع بنكي', 10000.00, null],
            ['2026-03-04', 'sukuk_order', 'طلب صكوك', -25000.00, null],
            ['2026-03-05', 'sukuk_order', 'طلب صكوك', -25000.00, null],
            ['2026-03-05', 'bank_deposit', 'إيداع بنكي', 5000.00, null],
            ['2026-03-05', 'bank_withdrawal', 'سحب بنكي', -70000.00, null],

            ['2026-04-27', 'distribution', 'توزيعات دورية', 191.75, '0116-162'],
            ['2026-04-27', 'investment_fee', 'رسوم استثمار', -12.33, '0116-162'],
            ['2026-04-27', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -1.85, '0116-162'],
            ['2026-04-28', 'bank_withdrawal', 'سحب بنكي', -177.57, null],

            ['2026-05-19', 'distribution', 'توزيعات دورية', 402.00, 'alameen'],
            ['2026-05-19', 'investment_fee', 'رسوم استثمار', -24.38, 'alameen'],
            ['2026-05-19', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -3.66, 'alameen'],

            ['2026-06-02', 'distribution', 'توزيعات دورية', 194.25, 'kifah-6m'],
            ['2026-06-02', 'investment_fee', 'رسوم استثمار', -12.60, 'kifah-6m'],
            ['2026-06-02', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -1.89, 'kifah-6m'],
            ['2026-06-02', 'distribution', 'توزيعات دورية', 235.20, 'gulf-gate'],
            ['2026-06-02', 'investment_fee', 'رسوم استثمار', -15.12, 'gulf-gate'],
            ['2026-06-02', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -2.27, 'gulf-gate'],

            ['2026-06-03', 'distribution', 'توزيعات دورية', 400.00, 'kifah-12m'],
            ['2026-06-03', 'investment_fee', 'رسوم استثمار', -25.21, 'kifah-12m'],
            ['2026-06-03', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -3.79, 'kifah-12m'],
            ['2026-06-03', 'principal_return', 'القيمة الاسمية', 1000.00, null],
            ['2026-06-03', 'distribution', 'توزيعات دورية', 38.20, null],
            ['2026-06-03', 'investment_fee', 'رسوم استثمار', -2.55, null],
            ['2026-06-03', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -0.39, null],

            ['2026-06-04', 'bank_withdrawal', 'سحب بنكي', -2177.79, null],
            ['2026-06-04', 'distribution', 'توزيعات دورية', 195.00, 'asloob'],
            ['2026-06-04', 'investment_fee', 'رسوم استثمار', -12.60, 'asloob'],
            ['2026-06-04', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -1.89, 'asloob'],
            ['2026-06-04', 'bank_withdrawal', 'سحب بنكي', -180.51, null],

            ['2026-06-05', 'distribution', 'توزيعات دورية', 41.90, 'almahatta'],
            ['2026-06-05', 'investment_fee', 'رسوم استثمار', -2.52, 'almahatta'],
            ['2026-06-05', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -0.38, 'almahatta'],

            // Alkarama group and its withdrawal. The 39.00 carried from 5 June plus
            // 958.78 net Alkarama profit equals the visible 997.78 withdrawal.
            ['2026-06-11', 'distribution', 'توزيعات دورية', 1031.25, 'alkarama'],
            ['2026-06-11', 'investment_fee', 'رسوم استثمار', -63.01, 'alkarama'],
            ['2026-06-11', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -9.46, 'alkarama'],
            ['2026-06-11', 'bank_withdrawal', 'سحب بنكي', -997.78, null],

            // Missing rows from the Mohammed Al-Taleb group. The -63.01 fee and
            // -896.28 withdrawal were already imported in the previous screenshot batch.
            ['2026-06-11', 'distribution', 'توزيعات دورية', 968.75, 'mohammed-al-taleb'],
            ['2026-06-11', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -9.46, 'mohammed-al-taleb'],
        ];

        foreach ($rows as $index => [$date, $type, $title, $amount, $investmentKey]) {
            $investmentId = $investmentKey ? (int) ($investmentIds[$investmentKey] ?? 0) : 0;
            $sourceKey = implode('|', [
                self::SOURCE,
                str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT),
                $date,
                $type,
                number_format((float) $amount, 2, '.', ''),
            ]);

            DB::table('dinar_account_transactions')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'source_key' => $sourceKey,
                ],
                [
                    'dinar_investment_id' => $investmentId > 0 ? $investmentId : null,
                    'transaction_date' => $date,
                    'transaction_type' => $type,
                    'title' => $title,
                    'signed_amount' => $amount,
                    'source' => self::SOURCE,
                    'notes' => 'مستورد من صور سجل العمليات المالية لمنصة دينار المرسلة بتاريخ 2026-09-04.',
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

        $actual = [
            'count' => (int) (clone $query)->count(),
            'deposits' => round((float) (clone $query)
                ->where('transaction_type', 'bank_deposit')->sum('signed_amount'), 2),
            'orders' => round(abs((float) (clone $query)
                ->where('transaction_type', 'sukuk_order')->sum('signed_amount')), 2),
            'withdrawals' => round(abs((float) (clone $query)
                ->where('transaction_type', 'bank_withdrawal')->sum('signed_amount')), 2),
            'distributions' => round((float) (clone $query)
                ->where('transaction_type', 'distribution')->sum('signed_amount'), 2),
            'principal' => round((float) (clone $query)
                ->where('transaction_type', 'principal_return')->sum('signed_amount'), 2),
            'fees' => round(abs((float) (clone $query)
                ->where('transaction_type', 'investment_fee')->sum('signed_amount')), 2),
            'vat' => round(abs((float) (clone $query)
                ->where('transaction_type', 'vat')->sum('signed_amount')), 2),
        ];

        $expected = [
            'count' => 42,
            'deposits' => 81000.00,
            'orders' => 50000.00,
            'withdrawals' => 73533.65,
            'distributions' => 3698.30,
            'principal' => 1000.00,
            'fees' => 170.32,
            'vat' => 35.04,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException('Older Dinar statement import failed: ' . json_encode($actual));
        }

        // The newly imported rows plus the two previously visible Mohammed rows
        // (-63.01 fee and -896.28 withdrawal) reconcile to a 39,000 SAR opening
        // carry balance before the first visible 4 March transaction. We retain
        // that as a reconciliation fact only; no artificial deposit is created.
        $previousMohammed = DB::table('dinar_account_transactions')
            ->where('user_id', $userId)
            ->where('source', self::PREVIOUS_SOURCE)
            ->whereDate('transaction_date', '2026-06-11')
            ->whereIn('transaction_type', ['investment_fee', 'bank_withdrawal'])
            ->sum('signed_amount');

        $newNet = (float) DB::table('dinar_account_transactions')
            ->where('user_id', $userId)
            ->where('source', self::SOURCE)
            ->sum('signed_amount');

        if (round($newNet + (float) $previousMohammed, 2) !== -39000.00) {
            throw new RuntimeException('Dinar opening-balance reconciliation failed.');
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
