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
            ->where('name', 'فيلا أبحر')
            ->first();

        if (! $debt) {
            return;
        }

        DB::transaction(function () use ($debt): void {
            $monthlyAmount = 7989.97;
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
                    'original_amount' => 615227.69,
                    'auto_payment_day' => 26,
                    'notes' => 'العقد التمويلي 15-10-2012، أول قسط 26-11-2012، دفعة أولى 200,000 ر.س، مبلغ التمويل 1,200,000 ر.س، الربح 717,592.80 ر.س، هامش الربح 2.9899%. المتبقي 77 قسطًا من 26-07-2026 حتى 26-11-2032، وتسحب الأقساط آليًا يوم 26 من كل شهر.',
                    'updated_at' => now(),
                ]);

            DB::table('debt_installments')
                ->where('debt_id', $debt->id)
                ->delete();

            $cursor = Carbon::create(2026, 7, 26)->startOfDay();
            $end = Carbon::create(2032, 11, 26)->startOfDay();
            $rows = [];
            $now = now();

            while ($cursor->lte($end)) {
                $month = $cursor->format('Y-m');
                $existing = $existingPayments->get($month, []);
                $paidAmount = min($monthlyAmount, (float) ($existing['paid_amount'] ?? 0));
                $paidAt = $existing['paid_at'] ?? null;
                $status = $paidAmount >= $monthlyAmount
                    ? 'paid'
                    : ($paidAmount > 0 ? 'partial' : 'pending');

                $rows[] = [
                    'debt_id' => $debt->id,
                    'due_date' => $cursor->toDateString(),
                    'scheduled_amount' => $monthlyAmount,
                    'paid_amount' => $paidAmount,
                    'paid_at' => $paidAt,
                    'status' => $status,
                    'notes' => $month === '2032-11' ? 'الدفعة الأخيرة' : null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $cursor->addMonthNoOverflow();
            }

            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('debt_installments')->insert($chunk);
            }
        });
    }

    public function down(): void
    {
        // لا يتم التراجع تلقائيًا حتى لا تُفقد أي دفعات مسجلة لاحقًا.
    }
};
