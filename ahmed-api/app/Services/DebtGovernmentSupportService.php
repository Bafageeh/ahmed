<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DebtGovernmentSupportService
{
    public function apply(?int $userId = null, ?int $debtId = null): int
    {
        if (
            ! Schema::hasTable('debts')
            || ! Schema::hasTable('debt_installments')
            || ! Schema::hasColumn('debts', 'monthly_government_support')
            || ! Schema::hasColumn('debt_installments', 'government_support_paid_amount')
        ) {
            return 0;
        }

        $today = Carbon::now('Asia/Riyadh')->startOfDay();

        $query = DB::table('debt_installments as installment')
            ->join('debts as debt', 'debt.id', '=', 'installment.debt_id')
            ->where('debt.monthly_government_support', '>', 0)
            ->whereDate('installment.due_date', '<=', $today->toDateString())
            ->whereColumn('installment.paid_amount', '<', 'installment.scheduled_amount')
            ->select([
                'installment.id',
                'installment.due_date',
                'installment.scheduled_amount',
                'installment.paid_amount',
                'installment.government_support_paid_amount',
                'installment.paid_at',
                'installment.notes',
                'debt.monthly_government_support',
            ]);

        if ($userId !== null) {
            $query->where('debt.user_id', $userId);
        }

        if ($debtId !== null) {
            $query->where('debt.id', $debtId);
        }

        $items = $query->get()->filter(function ($item) {
            $paid = (float) $item->paid_amount;
            $supportPaid = (float) $item->government_support_paid_amount;
            $monthlySupport = (float) $item->monthly_government_support;

            return $supportPaid < $monthlySupport || $paid < $supportPaid;
        });

        if ($items->isEmpty()) {
            return 0;
        }

        $updatedCount = 0;

        DB::transaction(function () use ($items, &$updatedCount): void {
            foreach ($items as $item) {
                $scheduled = (float) $item->scheduled_amount;
                $paid = (float) $item->paid_amount;
                $supportAlreadyPaid = min($scheduled, (float) $item->government_support_paid_amount);
                $monthlySupport = (float) $item->monthly_government_support;

                // الدعم الحكومي لا يُلغى عند إلغاء دفعة المستخدم يدويًا.
                $paidWithRestoredSupport = max($paid, $supportAlreadyPaid);
                $remainingInstallment = max(0, $scheduled - $paidWithRestoredSupport);
                $remainingSupport = max(0, $monthlySupport - $supportAlreadyPaid);
                $supportToApply = min($remainingInstallment, $remainingSupport);
                $newPaid = min($scheduled, $paidWithRestoredSupport + $supportToApply);
                $newSupportPaid = min($scheduled, $supportAlreadyPaid + $supportToApply);

                if ($newPaid === $paid && $newSupportPaid === $supportAlreadyPaid) {
                    continue;
                }

                $status = $newPaid >= $scheduled ? 'paid' : 'partial';
                $notes = trim((string) ($item->notes ?? ''));
                if (! str_contains($notes, 'دعم حكومي')) {
                    $notes = trim($notes . ($notes !== '' ? ' | ' : '') . 'دعم حكومي شهري');
                }

                DB::table('debt_installments')
                    ->where('id', $item->id)
                    ->update([
                        'paid_amount' => $newPaid,
                        'government_support_paid_amount' => $newSupportPaid,
                        'paid_at' => $item->paid_at ?: $item->due_date,
                        'status' => $status,
                        'notes' => $notes,
                        'updated_at' => now(),
                    ]);

                $updatedCount++;
            }
        });

        return $updatedCount;
    }
}
