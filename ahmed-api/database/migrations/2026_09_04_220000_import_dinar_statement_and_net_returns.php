<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SOURCE = 'dinar_statement_screenshots_2026_09_04';

    public function up(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasTable('dinar_payments')) {
            return;
        }

        $this->ensurePaymentAccountingColumns();
        $this->ensureTransactionLedger();

        $userId = $this->ahmedUserId();
        if (! $userId) {
            return;
        }

        DB::transaction(function () use ($userId) {
            $investmentIds = Schema::hasTable('dinar_investments')
                ? DB::table('dinar_investments')
                    ->where('user_id', $userId)
                    ->whereIn('external_key', [
                        'mohammed-al-taleb',
                        'kifah-12m',
                        'kifah-6m',
                        'gulf-gate',
                        'alameen',
                        '0116-162',
                    ])
                    ->pluck('id', 'external_key')
                : collect();

            // Reconcile the distributions that can be matched unambiguously to
            // existing Dinar opportunities. paid_amount stays gross; net_distribution
            // is what was actually earned after investment fee and VAT.
            $matched = [
                ['kifah-12m', '2026-09-03', 400.00, 25.21, 3.79, 371.00],
                ['kifah-6m', '2026-09-02', 194.25, 12.74, 1.92, 179.59],
                ['gulf-gate', '2026-09-02', 235.20, 15.12, 2.27, 217.81],
                ['alameen', '2026-08-19', 402.00, 25.21, 3.79, 373.00],
                ['0116-162', '2026-07-27', 191.75, 12.60, 1.89, 177.26],
            ];

            foreach ($matched as [$key, $date, $gross, $fee, $vat, $net]) {
                $investmentId = (int) ($investmentIds[$key] ?? 0);
                if ($investmentId <= 0) {
                    continue;
                }

                DB::table('dinar_payments')
                    ->where('user_id', $userId)
                    ->where('dinar_investment_id', $investmentId)
                    ->whereDate('due_date', $date)
                    ->update([
                        'is_paid' => true,
                        'paid_at' => $date,
                        'paid_amount' => $gross,
                        'investment_fee' => $fee,
                        'vat_amount' => $vat,
                        'net_distribution' => $net,
                        'statement_verified' => true,
                        'statement_key' => self::SOURCE . '|' . $key . '|' . $date,
                        'updated_at' => now(),
                    ]);
            }

            // The 11 June withdrawal reconciles exactly to the previously saved
            // 968.75 distribution: 968.75 - 63.01 - 9.46 = 896.28.
            // The VAT amount is therefore a reconciliation-derived value because
            // its row is just below the visible edge of the supplied screenshot.
            $mohammedId = (int) ($investmentIds['mohammed-al-taleb'] ?? 0);
            if ($mohammedId > 0) {
                DB::table('dinar_payments')
                    ->where('user_id', $userId)
                    ->where('dinar_investment_id', $mohammedId)
                    ->where('total_distribution', 968.75)
                    ->update([
                        'is_paid' => true,
                        'paid_at' => '2026-06-11',
                        'paid_amount' => 968.75,
                        'investment_fee' => 63.01,
                        'vat_amount' => 9.46,
                        'net_distribution' => 896.28,
                        'statement_verified' => true,
                        'statement_key' => self::SOURCE . '|mohammed-al-taleb|2026-06-11-reconciled',
                        'notes' => 'صافي 896.28 مطابق للسحب البنكي بتاريخ 2026-06-11؛ ضريبة 9.46 مشتقة بالمطابقة المحاسبية.',
                        'updated_at' => now(),
                    ]);
            }

            // 14 June contains a complete principal return + distribution that is
            // visible in the account statement but cannot be tied safely to one of
            // the currently named opportunities. Keep it as an unlinked payment so
            // the profit is counted without reducing the wrong opportunity balance.
            DB::table('dinar_payments')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'statement_key' => self::SOURCE . '|unlinked|2026-06-14',
                ],
                [
                    'dinar_investment_id' => null,
                    'installment_no' => null,
                    'due_date' => '2026-06-14',
                    'distribution_per_unit' => 0,
                    'principal_per_unit' => 0,
                    'total_distribution' => 67.00,
                    'total_principal' => 2000.00,
                    'is_paid' => true,
                    'paid_at' => '2026-06-14',
                    'paid_amount' => 67.00,
                    'investment_fee' => 5.10,
                    'vat_amount' => 0.77,
                    'net_distribution' => 61.13,
                    'statement_verified' => true,
                    'title' => 'دفعة دينار غير مربوطة بفرصة - 14 يونيو 2026',
                    'notes' => 'القيمة الاسمية 2,000 + توزيع 67 - رسوم 5.10 - ضريبة 0.77 = صافي ربح 61.13.',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            $this->importVisibleTransactions($userId, $investmentIds);
            $this->assertReconciliation($userId);
        });
    }

    public function down(): void
    {
        // Financial history and reconciled payment facts are intentionally retained
        // during deployment rollbacks. Dropping them could re-inflate invested capital.
    }

    private function ensurePaymentAccountingColumns(): void
    {
        $columns = [
            'investment_fee' => fn (Blueprint $table) => $table->decimal('investment_fee', 15, 2)->default(0),
            'vat_amount' => fn (Blueprint $table) => $table->decimal('vat_amount', 15, 2)->default(0),
            'net_distribution' => fn (Blueprint $table) => $table->decimal('net_distribution', 15, 2)->nullable(),
            'statement_verified' => fn (Blueprint $table) => $table->boolean('statement_verified')->default(false),
            'statement_key' => fn (Blueprint $table) => $table->string('statement_key', 190)->nullable()->index(),
        ];

        foreach ($columns as $column => $definition) {
            if (! Schema::hasColumn('dinar_payments', $column)) {
                Schema::table('dinar_payments', function (Blueprint $table) use ($definition) {
                    $definition($table);
                });
            }
        }
    }

    private function ensureTransactionLedger(): void
    {
        if (Schema::hasTable('dinar_account_transactions')) {
            return;
        }

        Schema::create('dinar_account_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('dinar_investment_id')->nullable()->index();
            $table->string('source_key', 190);
            $table->date('transaction_date')->index();
            $table->string('transaction_type', 40)->index();
            $table->string('title');
            $table->decimal('signed_amount', 15, 2);
            $table->string('source', 80)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'source_key'], 'dinar_tx_user_source_unique');
        });
    }

    private function importVisibleTransactions(int $userId, $investmentIds): void
    {
        // Exact rows visible in the three supplied Dinar account screenshots.
        // Positive amounts are credits to Dinar; negative amounts are fees/withdrawals.
        $rows = [
            ['2026-09-03', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -3.79, 'kifah-12m'],
            ['2026-09-03', 'investment_fee', 'رسوم استثمار', -25.21, 'kifah-12m'],
            ['2026-09-03', 'distribution', 'توزيعات دورية', 400.00, 'kifah-12m'],
            ['2026-09-02', 'bank_withdrawal', 'سحب بنكي', -5397.40, null],
            ['2026-09-02', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -1.92, 'kifah-6m'],
            ['2026-09-02', 'investment_fee', 'رسوم استثمار', -12.74, 'kifah-6m'],
            ['2026-09-02', 'principal_return', 'القيمة الاسمية', 5000.00, 'kifah-6m'],
            ['2026-09-02', 'distribution', 'توزيعات دورية', 194.25, 'kifah-6m'],
            ['2026-09-02', 'investment_fee', 'رسوم استثمار', -15.12, 'gulf-gate'],
            ['2026-09-02', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -2.27, 'gulf-gate'],
            ['2026-09-02', 'distribution', 'توزيعات دورية', 235.20, 'gulf-gate'],
            ['2026-08-21', 'bank_withdrawal', 'سحب بنكي', -373.00, null],
            ['2026-08-19', 'investment_fee', 'رسوم استثمار', -25.21, 'alameen'],
            ['2026-08-19', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -3.79, 'alameen'],
            ['2026-08-19', 'distribution', 'توزيعات دورية', 402.00, 'alameen'],
            ['2026-07-27', 'bank_withdrawal', 'سحب بنكي', -5177.26, null],
            ['2026-07-27', 'investment_fee', 'رسوم استثمار', -12.60, '0116-162'],
            ['2026-07-27', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -1.89, '0116-162'],
            ['2026-07-27', 'principal_return', 'القيمة الاسمية', 5000.00, '0116-162'],
            ['2026-07-27', 'distribution', 'توزيعات دورية', 191.75, '0116-162'],
            ['2026-06-14', 'bank_withdrawal', 'سحب بنكي', -2061.13, null],
            ['2026-06-14', 'vat', 'ضريبة القيمة المضافة على رسوم الاستثمار', -0.77, null],
            ['2026-06-14', 'investment_fee', 'رسوم استثمار', -5.10, null],
            ['2026-06-14', 'distribution', 'توزيعات دورية', 67.00, null],
            ['2026-06-14', 'principal_return', 'القيمة الاسمية', 2000.00, null],
            ['2026-06-11', 'bank_withdrawal', 'سحب بنكي', -896.28, null],
            ['2026-06-11', 'investment_fee', 'رسوم استثمار', -63.01, null],
        ];

        foreach ($rows as $index => [$date, $type, $title, $amount, $investmentKey]) {
            $investmentId = $investmentKey ? (int) ($investmentIds[$investmentKey] ?? 0) : 0;
            $sourceKey = implode('|', [
                self::SOURCE,
                str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
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
                    'notes' => 'مستورد من سجل عمليات منصة دينار المرسل بتاريخ 2026-09-04.',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    private function assertReconciliation(int $userId): void
    {
        $source = DB::table('dinar_account_transactions')
            ->where('user_id', $userId)
            ->where('source', self::SOURCE);

        $actual = [
            'count' => (int) (clone $source)->count(),
            'distributions' => round((float) (clone $source)
                ->where('transaction_type', 'distribution')->sum('signed_amount'), 2),
            'principal' => round((float) (clone $source)
                ->where('transaction_type', 'principal_return')->sum('signed_amount'), 2),
            'fees' => round(abs((float) (clone $source)
                ->where('transaction_type', 'investment_fee')->sum('signed_amount')), 2),
            'vat_visible' => round(abs((float) (clone $source)
                ->where('transaction_type', 'vat')->sum('signed_amount')), 2),
            'withdrawals' => round(abs((float) (clone $source)
                ->where('transaction_type', 'bank_withdrawal')->sum('signed_amount')), 2),
        ];

        $expected = [
            'count' => 27,
            'distributions' => 1490.20,
            'principal' => 12000.00,
            'fees' => 158.99,
            'vat_visible' => 14.43,
            'withdrawals' => 13905.07,
        ];

        if ($actual !== $expected) {
            throw new RuntimeException('Dinar statement reconciliation failed: ' . json_encode($actual));
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