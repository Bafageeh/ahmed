<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $debt = DB::table('debts')
            ->where('user_id', 1)
            ->where(function ($query) {
                $query->whereIn('name', ['سيارة مرسيدس', 'مرسيدس'])
                    ->orWhereIn('original_amount', [418887.89, 460940.22]);
            })
            ->first();

        if (! $debt) {
            return;
        }

        DB::transaction(function () use ($debt): void {
            $contractTotal = 501186.52;
            $paidTotal = 84415.17;
            $monthlyAmount = 5627.67;
            $normalRemainingCount = 45;
            $finalAmount = round($contractTotal - $paidTotal - ($normalRemainingCount * $monthlyAmount), 2); // 163,526.20

            DB::table('debts')
                ->where('id', $debt->id)
                ->update([
                    'name' => 'سيارة مرسيدس',
                    'category' => 'سيارة',
                    'contract_date' => '2025-04-27',
                    'financing_amount' => 397344.05,
                    'profit_amount' => 63596.17,
                    'profit_margin' => null,
                    'original_amount' => $contractTotal,
                    'opening_paid_amount' => 0.00,
                    'auto_payment_day' => null,
                    'notes' => 'تم تأكيد المبلغ الكلي لتمويل سيارة مرسيدس من شاشة التأجير: 501,186.52 ر.س. المبلغ الرئيسي 397,344.05 ر.س، الربح الإجمالي الظاهر 63,596.17 ر.س، مدة التمويل 61 شهر، تاريخ العقد 27-04-2025، بداية التقسيط 27-05-2025، نهاية التقسيط 28-04-2030، القسط الشهري 5,627.67 ر.س، المدفوع 84,415.17 ر.س بعدد 15 قسطًا، والمتبقي 46 قسطًا بإجمالي 416,771.35 ر.س. آخر دفعة تسوية 163,526.20 ر.س حتى يغلق التمويل بالكامل.',
                    'updated_at' => now(),
                ]);

            // أبقِ أول 15 دفعة المدفوعة كما هي، وثبّت 45 دفعة شهرية عادية متبقية.
            $unpaid = DB::table('debt_installments')
                ->where('debt_id', $debt->id)
                ->where('paid_amount', 0)
                ->orderBy('due_date')
                ->orderBy('id')
                ->get();

            if ($unpaid->count() >= 46) {
                foreach ($unpaid->take(45) as $installment) {
                    DB::table('debt_installments')
                        ->where('id', $installment->id)
                        ->update([
                            'scheduled_amount' => $monthlyAmount,
                            'status' => 'pending',
                            'updated_at' => now(),
                        ]);
                }

                $last = $unpaid->skip(45)->first();
                DB::table('debt_installments')
                    ->where('id', $last->id)
                    ->update([
                        'due_date' => '2030-04-28',
                        'scheduled_amount' => $finalAmount,
                        'paid_amount' => 0.00,
                        'paid_at' => null,
                        'status' => 'pending',
                        'notes' => 'الدفعة الأخيرة حسب إجمالي التمويل المؤكد 501,186.52 ر.س',
                        'updated_at' => now(),
                    ]);

                // إزالة أي صفوف زائدة لو وُجدت من الجدول القديم.
                $extraIds = $unpaid->skip(46)->pluck('id');
                if ($extraIds->isNotEmpty()) {
                    DB::table('debt_installments')->whereIn('id', $extraIds)->delete();
                }
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

        DB::table('debts')
            ->where('id', $debt->id)
            ->update([
                'original_amount' => 460940.22,
                'updated_at' => now(),
            ]);

        $last = DB::table('debt_installments')
            ->where('debt_id', $debt->id)
            ->orderByDesc('due_date')
            ->orderByDesc('id')
            ->first();

        if ($last) {
            DB::table('debt_installments')
                ->where('id', $last->id)
                ->update([
                    'scheduled_amount' => 123279.90,
                    'updated_at' => now(),
                ]);
        }
    }
};
