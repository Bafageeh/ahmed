<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $debt = DB::table('debts')
            ->where('user_id', 1)
            ->whereIn('name', ['فيلا أبحر', 'فيلا'])
            ->first();

        if (! $debt) {
            return;
        }

        DB::transaction(function () use ($debt): void {
            DB::table('debts')
                ->where('id', $debt->id)
                ->update([
                    'name' => 'فيلا أبحر',
                    'original_amount' => 1917592.80,
                    'opening_paid_amount' => 1294375.14,
                    'auto_payment_day' => 26,
                    'updated_at' => now(),
                ]);

            DB::table('debt_installments')->updateOrInsert(
                [
                    'debt_id' => $debt->id,
                    'due_date' => '2026-06-26',
                ],
                [
                    'scheduled_amount' => 7989.97,
                    'paid_amount' => 7989.97,
                    'paid_at' => '2026-06-26',
                    'status' => 'paid',
                    'notes' => 'مسدد تلقائيًا حسب تأكيد المستخدم',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        });
    }

    public function down(): void
    {
        // لا يتم حذف السداد التاريخي تلقائيًا.
    }
};
