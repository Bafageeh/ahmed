<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DebtController extends Controller
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $this->applyAutomaticPayments($userId);

        $debts = DB::table('debts')
            ->where('user_id', $userId)
            ->orderBy('id')
            ->get();

        $installments = $debts->isEmpty()
            ? collect()
            : DB::table('debt_installments')
                ->whereIn('debt_id', $debts->pluck('id'))
                ->orderBy('due_date')
                ->orderBy('id')
                ->get();

        $grouped = $installments->groupBy('debt_id');
        $items = $debts->map(fn ($debt) => $this->normalizeDebt($debt, $grouped->get($debt->id, collect())));

        return response()->json([
            'data' => $items,
            'summary' => $this->portfolioSummary($items, $installments),
        ]);
    }

    public function show(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $this->applyAutomaticPayments($userId, $id);

        $debt = DB::table('debts')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (! $debt) {
            return response()->json(['message' => 'الدين غير موجود'], 404);
        }

        $installments = DB::table('debt_installments')
            ->where('debt_id', $debt->id)
            ->orderBy('due_date')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $this->normalizeDebt($debt, $installments, true),
        ]);
    }

    public function pay(Request $request, int $installmentId)
    {
        $data = $request->validate([
            'paid_amount' => ['nullable', 'numeric', 'min:0.01'],
            'paid_at' => ['nullable', 'date'],
        ]);

        $installment = $this->findInstallment($request, $installmentId);
        if (! $installment) {
            return response()->json(['message' => 'القسط غير موجود'], 404);
        }

        $scheduled = (float) $installment->scheduled_amount;
        $alreadyPaid = (float) $installment->paid_amount;
        $remaining = max(0, $scheduled - $alreadyPaid);
        $payment = array_key_exists('paid_amount', $data)
            ? min($remaining, (float) $data['paid_amount'])
            : $remaining;

        if ($remaining <= 0) {
            return response()->json([
                'data' => $this->normalizeInstallment($installment),
                'message' => 'القسط مسدد بالكامل مسبقًا',
            ]);
        }

        $newPaid = min($scheduled, $alreadyPaid + $payment);
        $status = $newPaid >= $scheduled ? 'paid' : 'partial';

        DB::table('debt_installments')
            ->where('id', $installmentId)
            ->update([
                'paid_amount' => $newPaid,
                'paid_at' => $data['paid_at'] ?? now()->toDateString(),
                'status' => $status,
                'updated_at' => now(),
            ]);

        $updated = DB::table('debt_installments')->where('id', $installmentId)->first();

        return response()->json([
            'data' => $this->normalizeInstallment($updated),
            'message' => $status === 'paid' ? 'تم تسجيل سداد القسط' : 'تم تسجيل سداد جزئي',
        ]);
    }

    public function undoPayment(Request $request, int $installmentId)
    {
        $installment = $this->findInstallment($request, $installmentId);
        if (! $installment) {
            return response()->json(['message' => 'القسط غير موجود'], 404);
        }

        DB::table('debt_installments')
            ->where('id', $installmentId)
            ->update([
                'paid_amount' => 0,
                'paid_at' => null,
                'status' => 'pending',
                'updated_at' => now(),
            ]);

        $updated = DB::table('debt_installments')->where('id', $installmentId)->first();

        return response()->json([
            'data' => $this->normalizeInstallment($updated),
            'message' => 'تم إلغاء تسجيل السداد',
        ]);
    }

    private function normalizeDebt(object $debt, Collection $installments, bool $withInstallments = false): array
    {
        $normalizedInstallments = $installments->map(fn ($installment) => $this->normalizeInstallment($installment));
        $original = (float) $debt->original_amount;
        $paid = $normalizedInstallments->sum(fn ($item) => (float) $item['paid_amount']);
        $remaining = max(0, $original - $paid);
        $overdue = $normalizedInstallments->filter(fn ($item) => in_array($item['status'], ['late', 'late_partial'], true));
        $currentMonth = now()->format('Y-m');
        $currentMonthItems = $normalizedInstallments->filter(fn ($item) => str_starts_with($item['due_date'], $currentMonth));
        $next = $normalizedInstallments->first(fn ($item) => (float) $item['remaining_amount'] > 0);
        $endDate = $normalizedInstallments->max('due_date');
        $paidCount = $normalizedInstallments->filter(fn ($item) => $item['status'] === 'paid')->count();
        $totalCount = $normalizedInstallments->count();

        $result = [
            'id' => $debt->id,
            'user_id' => $debt->user_id,
            'name' => $debt->name,
            'category' => $debt->category,
            'original_amount' => round($original, 2),
            'paid_amount' => round($paid, 2),
            'remaining_amount' => round($remaining, 2),
            'progress_percent' => $original > 0 ? round(($paid / $original) * 100, 2) : 0,
            'installments_count' => $totalCount,
            'paid_installments_count' => $paidCount,
            'remaining_installments_count' => max(0, $totalCount - $paidCount),
            'overdue_count' => $overdue->count(),
            'overdue_amount' => round($overdue->sum(fn ($item) => (float) $item['remaining_amount']), 2),
            'current_month_due' => round($currentMonthItems->sum(fn ($item) => (float) $item['remaining_amount']), 2),
            'next_installment' => $next,
            'end_date' => $endDate,
            'status' => $remaining <= 0 ? 'completed' : ($overdue->isNotEmpty() ? 'late' : 'active'),
            'auto_payment_day' => $debt->auto_payment_day ?? null,
            'notes' => $debt->notes,
            'created_at' => $debt->created_at,
            'updated_at' => $debt->updated_at,
        ];

        if ($withInstallments) {
            $result['installments'] = $normalizedInstallments->values();
        }

        return $result;
    }

    private function normalizeInstallment(object $installment): array
    {
        $scheduled = (float) $installment->scheduled_amount;
        $paid = min($scheduled, (float) $installment->paid_amount);
        $remaining = max(0, $scheduled - $paid);
        $today = Carbon::today();
        $dueDate = Carbon::parse($installment->due_date);

        if ($remaining <= 0) {
            $status = 'paid';
        } elseif ($paid > 0) {
            $status = $dueDate->lt($today) ? 'late_partial' : 'partial';
        } elseif ($dueDate->lt($today)) {
            $status = 'late';
        } else {
            $status = 'pending';
        }

        return [
            'id' => $installment->id,
            'debt_id' => $installment->debt_id,
            'due_date' => $installment->due_date,
            'scheduled_amount' => round($scheduled, 2),
            'paid_amount' => round($paid, 2),
            'remaining_amount' => round($remaining, 2),
            'paid_at' => $installment->paid_at,
            'status' => $status,
            'notes' => $installment->notes,
        ];
    }

    private function portfolioSummary(Collection $debts, Collection $installments): array
    {
        $normalizedInstallments = $installments->map(fn ($installment) => $this->normalizeInstallment($installment));
        $currentMonth = now()->format('Y-m');
        $remainingInstallments = $normalizedInstallments->filter(fn ($item) => (float) $item['remaining_amount'] > 0);
        $overdue = $remainingInstallments->filter(fn ($item) => in_array($item['status'], ['late', 'late_partial'], true));
        $currentMonthItems = $remainingInstallments->filter(fn ($item) => str_starts_with($item['due_date'], $currentMonth));
        $next = $remainingInstallments->sortBy('due_date')->first();

        $monthlyCommitments = $remainingInstallments
            ->groupBy(fn ($item) => substr($item['due_date'], 0, 7))
            ->map(fn ($items, $month) => [
                'month' => $month,
                'amount' => round($items->sum(fn ($item) => (float) $item['remaining_amount']), 2),
            ])
            ->values();

        $highestMonth = $monthlyCommitments->sortByDesc('amount')->first();
        $totalOriginal = $debts->sum(fn ($debt) => (float) $debt['original_amount']);
        $totalPaid = $debts->sum(fn ($debt) => (float) $debt['paid_amount']);
        $totalRemaining = $debts->sum(fn ($debt) => (float) $debt['remaining_amount']);
        $remainingMonths = max(1, $monthlyCommitments->count());

        return [
            'active_debts' => $debts->filter(fn ($debt) => $debt['status'] !== 'completed')->count(),
            'completed_debts' => $debts->filter(fn ($debt) => $debt['status'] === 'completed')->count(),
            'total_original' => round($totalOriginal, 2),
            'total_paid' => round($totalPaid, 2),
            'total_remaining' => round($totalRemaining, 2),
            'progress_percent' => $totalOriginal > 0 ? round(($totalPaid / $totalOriginal) * 100, 2) : 0,
            'current_month_due' => round($currentMonthItems->sum(fn ($item) => (float) $item['remaining_amount']), 2),
            'overdue_amount' => round($overdue->sum(fn ($item) => (float) $item['remaining_amount']), 2),
            'overdue_count' => $overdue->count(),
            'remaining_installments_count' => $remainingInstallments->count(),
            'average_monthly_commitment' => round($totalRemaining / $remainingMonths, 2),
            'next_payment' => $next,
            'highest_month' => $highestMonth,
            'last_payment_date' => $remainingInstallments->max('due_date'),
        ];
    }

    private function applyAutomaticPayments(int $userId, ?int $debtId = null): void
    {
        if (! Schema::hasColumn('debts', 'auto_payment_day')) {
            return;
        }

        $today = Carbon::now('Asia/Riyadh')->startOfDay();
        $query = DB::table('debt_installments as installment')
            ->join('debts as debt', 'debt.id', '=', 'installment.debt_id')
            ->where('debt.user_id', $userId)
            ->whereNotNull('debt.auto_payment_day')
            ->whereDate('installment.due_date', '<=', $today->copy()->endOfMonth()->toDateString())
            ->whereColumn('installment.paid_amount', '<', 'installment.scheduled_amount')
            ->select([
                'installment.id',
                'installment.due_date',
                'installment.scheduled_amount',
                'debt.auto_payment_day',
            ]);

        if ($debtId !== null) {
            $query->where('debt.id', $debtId);
        }

        $dueInstallments = $query->get()->filter(function ($installment) use ($today) {
            $installmentMonth = Carbon::parse($installment->due_date, 'Asia/Riyadh')->startOfMonth();
            $automaticDay = min((int) $installment->auto_payment_day, $installmentMonth->daysInMonth);
            $automaticDate = $installmentMonth->copy()->day($automaticDay)->startOfDay();

            return $automaticDate->lte($today);
        });

        if ($dueInstallments->isEmpty()) {
            return;
        }

        DB::transaction(function () use ($dueInstallments): void {
            foreach ($dueInstallments as $installment) {
                $installmentMonth = Carbon::parse($installment->due_date, 'Asia/Riyadh')->startOfMonth();
                $automaticDay = min((int) $installment->auto_payment_day, $installmentMonth->daysInMonth);
                $automaticDate = $installmentMonth->copy()->day($automaticDay)->toDateString();

                DB::table('debt_installments')
                    ->where('id', $installment->id)
                    ->update([
                        'paid_amount' => (float) $installment->scheduled_amount,
                        'paid_at' => $automaticDate,
                        'status' => 'paid',
                        'updated_at' => now(),
                    ]);
            }
        });
    }

    private function findInstallment(Request $request, int $installmentId): ?object
    {
        return DB::table('debt_installments as installment')
            ->join('debts as debt', 'debt.id', '=', 'installment.debt_id')
            ->where('installment.id', $installmentId)
            ->where('debt.user_id', $this->userId($request))
            ->select('installment.*')
            ->first();
    }

    private function userId(Request $request): int
    {
        return (int) $request->attributes->get('ahmed_user_id');
    }
}
