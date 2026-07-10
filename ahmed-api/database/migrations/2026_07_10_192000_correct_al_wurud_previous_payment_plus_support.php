<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $debt = DB::table('debts')
            ->where('user_id', 1)
            ->whereIn('name', ['شقة الورود', 'شقة الورود 1'])
            ->first();

        if (! $debt) {
            return;
        }

        DB::transaction(function () use ($debt): void {
            $previousInstallmentAmount = 2042.00;
            $monthlySupport = 1048.70;
            $previousCount = 55;
            $previousInstallmentsTotal = round($previousInstallmentAmount * $previousCount, 2);
            $previousSupportTotal = round($monthlySupport * $previousCount, 2);
            $openingPaid = round($previousInstallmentsTotal + $previousSupportTotal, 2);
            $originalAmount = 791000.00;
            $remainingAmount = round($originalAmount - $openingPaid, 2);

            $existingPayments = DB::table('debt_installments')
                ->where('debt_id', $debt->id)
                ->get()
                ->mapWithKeys(function ($installment) {
                    return [Carbon::parse($installment->due_date)->format('Y-m') => [
                        'paid_amount' => (float) $installment->paid_amount,
                        'support_amount' => (float) ($installment->government_support_paid_amount ?? 0),
                        'paid_at' => $installment->paid_at,
                    ]];
                });

            DB::table('debts')->where('id', $debt->id)->update([
                'name' => 'شقة الورود',
                'contract_date' => '2021-11-16',
                'down_payment' => 500000.00,
                'financing_amount' => 500000.00,
                'profit_amount' => 291000.00,
                'profit_margin' => 2.9100,
                'previous_installment_amount' => $previousInstallmentAmount,
                'previous_installments_count' => $previousCount,
                'monthly_government_support' => $monthlySupport,
                'previous_support_count' => $previousCount,
                'previous_support_total' => $previousSupportTotal,
                'original_amount' => $originalAmount,
                'opening_paid_amount' => $openingPaid,
                'notes' => 'تاريخ العقد 16-11-2021، الدفعة الأولى 500,000 ر.س، مبلغ التمويل 500,000 ر.س، مبلغ الربح 291,000 ر.س، هامش الربح 2.91%. دفعات العميل السابقة 55 × 2,042.00 = 112,310.00 ر.س. الدعم الحكومي السابق 55 × 1,048.70 = 57,678.50 ر.س. إجمالي المسدد السابق من التمويل 169,988.50 ر.س، والمتبقي 621,011.50 ر.س. يستمر الدعم الحكومي الشهري بقيمة 1,048.70 ر.س ويخصم من القسط عند استحقاقه.',
                'updated_at' => now(),
            ]);

            DB::table('debt_installments')->where('debt_id', $debt->id)->delete();

            $rows = [];
            $cursor = Carbon::create(2026, 7, 1);
            $now = now();

            $append = function (float $amount, ?string $note = null) use (&$rows, &$cursor, $existingPayments, $debt, $now): void {
                $key = $cursor->format('Y-m');
                $existing = $existingPayments->get($key, []);
                $paid = min($amount, (float) ($existing['paid_amount'] ?? 0));
                $support = min($paid, (float) ($existing['support_amount'] ?? 0));

                $rows[] = [
                    'debt_id' => $debt->id,
                    'due_date' => $cursor->copy()->endOfMonth()->toDateString(),
                    'scheduled_amount' => $amount,
                    'paid_amount' => $paid,
                    'government_support_paid_amount' => $support,
                    'paid_at' => $existing['paid_at'] ?? null,
                    'status' => $paid >= $amount ? 'paid' : ($paid > 0 ? 'partial' : 'pending'),
                    'notes' => $note,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $cursor->addMonthNoOverflow();
            };

            for ($i = 0; $i < 12; $i++) {
                $append(3713.00);
            }
            for ($i = 0; $i < 5; $i++) {
                $append(2042.00);
            }
            for ($i = 0; $i < 152; $i++) {
                $append(3713.00);
            }
            $append(1869.50, 'الدفعة الأخيرة');

            $scheduledTotal = round(collect($rows)->sum('scheduled_amount'), 2);
            if ($scheduledTotal !== $remainingAmount) {
                throw new RuntimeException("جدول شقة الورود لا يساوي المتبقي: {$scheduledTotal} بدل {$remainingAmount}");
            }

            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('debt_installments')->insert($chunk);
            }
        });
    }

    public function down(): void
    {
        // لا يتم التراجع تلقائيًا حفاظًا على الدفعات المسجلة.
    }
};
