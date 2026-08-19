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
            ->where(function ($query) {
                $query->whereIn('name', ['سيارة مرسيدس', 'مرسيدس'])
                    ->orWhere('original_amount', 418887.89);
            })
            ->first();

        if (! $debt) {
            return;
        }

        DB::transaction(function () use ($debt): void {
            $financingAmount = 397344.05;
            $profitAmount = 63596.17;
            $contractTotal = round($financingAmount + $profitAmount, 2); // 460,940.22
            $monthlyAmount = 5627.67;
            $paidTotal = 84415.17;
            $paidCount = 15;
            $remainingCount = 46;

            DB::table('debts')
                ->where('id', $debt->id)
                ->update([
                    'name' => 'سيارة مرسيدس',
                    'category' => 'سيارة',
                    'contract_date' => '2025-04-27',
                    'down_payment' => 0.00,
                    'financing_amount' => $financingAmount,
                    'profit_amount' => $profitAmount,
                    // المصدر يعرض معدل الربح null، لذلك لا نفترض نسبة غير مؤكدة.
                    'profit_margin' => null,
                    'previous_installment_amount' => null,
                    'previous_installments_count' => null,
                    'original_amount' => $contractTotal,
                    'opening_paid_amount' => 0.00,
                    'auto_payment_day' => null,
                    'notes' => 'تم تحديث تمويل سيارة مرسيدس حسب بيانات التمويل: المبلغ الرئيسي 397,344.05 ر.س، الربح الإجمالي 63,596.17 ر.س، إجمالي العقد 460,940.22 ر.س، مدة التمويل 61 شهر، تاريخ العقد 27-04-2025، بداية التقسيط 27-05-2025، نهاية التقسيط 28-04-2030، القسط الشهري 5,627.67 ر.س، المدفوع 84,415.17 ر.س بعدد 15 دفعة، والمتبقي 46 دفعة. تم موازنة الدفعة الأخيرة حسابيًا حتى يساوي مجموع الدفعات إجمالي العقد لأن شاشة المصدر تعرض الدفعة الأخيرة 0.00 رغم عدم تطابق مجموع الأقساط الشهرية مع أصل التمويل والربح.',
                    'updated_at' => now(),
                ]);

            DB::table('debt_installments')
                ->where('debt_id', $debt->id)
                ->delete();

            $now = now();
            $rows = [];

            // أول 15 دفعة مدفوعة من 27-05-2025 حتى 27-07-2026.
            // أول دفعة في المصدر 5,627.68 ر.س. نضبط الدفعة رقم 15 بفارق التقريب
            // حتى يطابق إجمالي المدفوع الموثق 84,415.17 ر.س تمامًا.
            $cursor = Carbon::create(2025, 5, 27)->startOfDay();
            for ($i = 1; $i <= $paidCount; $i++) {
                $amount = $monthlyAmount;
                if ($i === 1) {
                    $amount = 5627.68;
                } elseif ($i === $paidCount) {
                    $amount = 5627.78;
                }

                $rows[] = [
                    'debt_id' => $debt->id,
                    'due_date' => $cursor->toDateString(),
                    'scheduled_amount' => $amount,
                    'paid_amount' => $amount,
                    'paid_at' => $cursor->toDateString(),
                    'status' => 'paid',
                    'notes' => $i === 1 ? 'الدفعة الأولى حسب بيانات المصدر' : null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $cursor->addMonthNoOverflow();
            }

            // 45 دفعة شهرية متبقية من أغسطس 2026 حتى 27-04-2030.
            for ($i = 1; $i <= $remainingCount - 1; $i++) {
                $rows[] = [
                    'debt_id' => $debt->id,
                    'due_date' => $cursor->toDateString(),
                    'scheduled_amount' => $monthlyAmount,
                    'paid_amount' => 0.00,
                    'paid_at' => null,
                    'status' => 'pending',
                    'notes' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $cursor->addMonthNoOverflow();
            }

            // الدفعة رقم 61 بتاريخ نهاية التقسيط الموثق 28-04-2030.
            // قيمتها هي الفرق الحسابي اللازم لإغلاق إجمالي العقد دون بقاء رصيد معلّق.
            $normalRemaining = ($remainingCount - 1) * $monthlyAmount;
            $finalAmount = round($contractTotal - $paidTotal - $normalRemaining, 2); // 123,279.90

            $rows[] = [
                'debt_id' => $debt->id,
                'due_date' => '2030-04-28',
                'scheduled_amount' => $finalAmount,
                'paid_amount' => 0.00,
                'paid_at' => null,
                'status' => 'pending',
                'notes' => 'تسوية ختامية محسوبة لضبط إجمالي العقد بالكامل',
                'created_at' => $now,
                'updated_at' => $now,
            ];

            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('debt_installments')->insert($chunk);
            }
        });
    }

    public function down(): void
    {
        $debt = DB::table('debts')
            ->where('user_id', 1)
            ->where('name', 'سيارة مرسيدس')
            ->first();

        if (! $debt) {
            return;
        }

        DB::transaction(function () use ($debt): void {
            DB::table('debts')
                ->where('id', $debt->id)
                ->update([
                    'contract_date' => null,
                    'down_payment' => 0.00,
                    'financing_amount' => null,
                    'profit_amount' => 0.00,
                    'profit_margin' => null,
                    'original_amount' => 418887.89,
                    'opening_paid_amount' => 0.00,
                    'notes' => 'مستورد من شيت خط زمني للأقساط. القسط الشهري 5,627.67 ر.س ثم دفعة أخيرة كبيرة.',
                    'updated_at' => now(),
                ]);

            DB::table('debt_installments')
                ->where('debt_id', $debt->id)
                ->delete();

            $now = now();
            $rows = [];
            $cursor = Carbon::create(2026, 7, 31)->startOfDay();
            $end = Carbon::create(2030, 5, 31)->startOfDay();

            while ($cursor->lte($end)) {
                $rows[] = [
                    'debt_id' => $debt->id,
                    'due_date' => $cursor->toDateString(),
                    'scheduled_amount' => 5627.67,
                    'paid_amount' => 0.00,
                    'paid_at' => null,
                    'status' => 'pending',
                    'notes' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $cursor->addMonthNoOverflow();
            }

            $rows[] = [
                'debt_id' => $debt->id,
                'due_date' => '2030-06-30',
                'scheduled_amount' => 154387.40,
                'paid_amount' => 0.00,
                'paid_at' => null,
                'status' => 'pending',
                'notes' => 'الدفعة الأخيرة',
                'created_at' => $now,
                'updated_at' => $now,
            ];

            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('debt_installments')->insert($chunk);
            }
        });
    }
};
