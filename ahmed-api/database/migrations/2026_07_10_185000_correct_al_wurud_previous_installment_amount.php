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
            ->whereIn('name', ['شقة الورود 1', 'شقة الورود'])
            ->first();

        if (! $debt) {
            return;
        }

        DB::transaction(function () use ($debt): void {
            $previousInstallmentAmount = 3090.70;
            $previousInstallmentsCount = 55;
            $openingPaid = round($previousInstallmentAmount * $previousInstallmentsCount, 2);
            $originalAmount = 791000.00;
            $remainingAmount = round($originalAmount - $openingPaid, 2);

            $existingPayments = DB::table('debt_installments')
                ->where('debt_id', $debt->id)
                ->get()
                ->mapWithKeys(function ($installment) {
                    $month = Carbon::parse($installment->due_date)->format('Y-m');

                    return [$month => [
                        'paid_amount' => (float) $installment->paid_amount,
                        'paid_at' => $installment->paid_at,
                    ]];
                });

            DB::table('debts')
                ->where('id', $debt->id)
                ->update([
                    'name' => 'شقة الورود',
                    'contract_date' => '2021-11-16',
                    'down_payment' => 500000.00,
                    'financing_amount' => 500000.00,
                    'profit_amount' => 291000.00,
                    'profit_margin' => 2.9100,
                    'previous_installment_amount' => $previousInstallmentAmount,
                    'previous_installments_count' => $previousInstallmentsCount,
                    'original_amount' => $originalAmount,
                    'opening_paid_amount' => $openingPaid,
                    'notes' => 'تاريخ العقد 16-11-2021، الدفعة الأولى 500,000 ر.س، مبلغ التمويل 500,000 ر.س، مبلغ الربح 291,000 ر.س، هامش الربح 2.91%. تم سداد 55 قسطًا سابقًا بقيمة 3,090.70 ر.س بإجمالي 169,988.50 ر.س، والمتبقي 621,011.50 ر.س. إجمالي تكلفة العقار مع الربح والدفعة الأولى 1,291,000 ر.س.',
                    'updated_at' => now(),
                ]);

            DB::table('debt_installments')
                ->where('debt_id', $debt->id)
                ->delete();

            $rows = [];
            $now = now();

            $appendMonth = function (Carbon $month, float $amount, ?string $note = null) use (&$rows, $existingPayments, $debt, $now): void {
                $key = $month->format('Y-m');
                $existing = $existingPayments->get($key, []);
                $paidAmount = min($amount, (float) ($existing['paid_amount'] ?? 0));
                $paidAt = $existing['paid_at'] ?? null;
                $status = $paidAmount >= $amount
                    ? 'paid'
                    : ($paidAmount > 0 ? 'partial' : 'pending');

                $rows[] = [
                    'debt_id' => $debt->id,
                    'due_date' => $month->copy()->endOfMonth()->toDateString(),
                    'scheduled_amount' => $amount,
                    'paid_amount' => $paidAmount,
                    'paid_at' => $paidAt,
                    'status' => $status,
                    'notes' => $note,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            };

            $cursor = Carbon::create(2026, 7, 1);
            for ($i = 0; $i < 12; $i++) {
                $appendMonth($cursor, 3713.00);
                $cursor->addMonthNoOverflow();
            }

            for ($i = 0; $i < 5; $i++) {
                $appendMonth($cursor, 2042.00);
                $cursor->addMonthNoOverflow();
            }

            for ($i = 0; $i < 152; $i++) {
                $appendMonth($cursor, 3713.00);
                $cursor->addMonthNoOverflow();
            }

            $appendMonth($cursor, 1869.50, 'الدفعة الأخيرة');

            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('debt_installments')->insert($chunk);
            }

            $scheduledTotal = round(collect($rows)->sum('scheduled_amount'), 2);
            if ($scheduledTotal !== $remainingAmount) {
                throw new RuntimeException("جدول شقة الورود لا يساوي المتبقي: {$scheduledTotal} بدل {$remainingAmount}");
            }
        });
    }

    public function down(): void
    {
        // لا يتم التراجع تلقائيًا حتى لا تُفقد أي دفعات مسجلة لاحقًا.
    }
};
