<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DebtAutoPaymentService
{
    public function apply(?int $userId = null, ?int $debtId = null): int
    {
        if (! Schema::hasTable('debts') || ! Schema::hasColumn('debts', 'auto_payment_day')) {
            return 0;
        }

        $today = Carbon::now('Asia/Riyadh')->startOfDay();
        $query = DB::table('debt_installments as installment')
            ->join('debts as debt', 'debt.id', '=', 'installment.debt_id')
            ->whereNotNull('debt.auto_payment_day')
            ->whereDate('installment.due_date', '<=', $today->copy()->endOfMonth()->toDateString())
            ->whereColumn('installment.paid_amount', '<', 'installment.scheduled_amount')
            ->select([
                'installment.id',
                'installment.due_date',
                'installment.scheduled_amount',
                'debt.auto_payment_day',
            ]);

        if ($userId !== null) {
            $query->where('debt.user_id', $userId);
        }

        if ($debtId !== null) {
            $query->where('debt.id', $debtId);
        }

        $dueInstallments = $query->get()->filter(function ($installment) use ($today) {
            $automaticDate = $this->automaticDate(
                $installment->due_date,
                (int) $installment->auto_payment_day
            );

            return $automaticDate->lte($today);
        });

        if ($dueInstallments->isEmpty()) {
            return 0;
        }

        DB::transaction(function () use ($dueInstallments): void {
            foreach ($dueInstallments as $installment) {
                $automaticDate = $this->automaticDate(
                    $installment->due_date,
                    (int) $installment->auto_payment_day
                );

                DB::table('debt_installments')
                    ->where('id', $installment->id)
                    ->update([
                        'paid_amount' => (float) $installment->scheduled_amount,
                        'paid_at' => $automaticDate->toDateString(),
                        'status' => 'paid',
                        'updated_at' => now(),
                    ]);
            }
        });

        return $dueInstallments->count();
    }

    private function automaticDate(string $dueDate, int $automaticDay): Carbon
    {
        $month = Carbon::parse($dueDate, 'Asia/Riyadh')->startOfMonth();
        $day = min(max(1, $automaticDay), $month->daysInMonth);

        return $month->copy()->day($day)->startOfDay();
    }
}
