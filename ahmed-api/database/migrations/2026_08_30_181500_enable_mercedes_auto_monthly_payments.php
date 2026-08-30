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
                    ->orWhere('original_amount', 501186.52);
            })
            ->first();

        if (! $debt) {
            return;
        }

        $today = Carbon::now('Asia/Riyadh')->startOfDay();

        DB::transaction(function () use ($debt, $today): void {
            DB::table('debts')
                ->where('id', $debt->id)
                ->update([
                    'auto_payment_day' => 27,
                    'updated_at' => now(),
                ]);

            // تمويل المرسيدس يسدد آليًا يوم 27 من كل شهر؛ لذلك لا نترك
            // أي قسط حل موعده حتى اليوم بحالة متأخر عند تفعيل الأتمتة.
            $dueInstallments = DB::table('debt_installments')
                ->where('debt_id', $debt->id)
                ->whereDate('due_date', '<=', $today->toDateString())
                ->whereColumn('paid_amount', '<', 'scheduled_amount')
                ->get();

            foreach ($dueInstallments as $installment) {
                DB::table('debt_installments')
                    ->where('id', $installment->id)
                    ->update([
                        'paid_amount' => (float) $installment->scheduled_amount,
                        'paid_at' => $installment->due_date,
                        'status' => 'paid',
                        'updated_at' => now(),
                    ]);
            }
        });
    }

    public function down(): void
    {
        DB::table('debts')
            ->where('user_id', 1)
            ->where(function ($query) {
                $query->whereIn('name', ['سيارة مرسيدس', 'مرسيدس'])
                    ->orWhere('original_amount', 501186.52);
            })
            ->update([
                'auto_payment_day' => null,
                'updated_at' => now(),
            ]);
    }
};
