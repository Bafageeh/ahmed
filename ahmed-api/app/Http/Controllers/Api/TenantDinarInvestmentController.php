<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TenantDinarInvestmentController extends DinarInvestmentController
{
    public function index(Request $request)
    {
        if ($this->isAdmin($request)) {
            return parent::index($request);
        }

        $userId = (int) $request->attributes->get('ahmed_user_id', 0);
        abort_unless($userId > 0, 401, 'يجب تسجيل الدخول أولاً');

        if (! Schema::hasTable('dinar_investments') || ! Schema::hasTable('dinar_payments')) {
            return response()->json([
                'data' => [],
                'unlinked_payments' => [],
                'summary' => $this->emptySummary(),
            ]);
        }

        $items = DB::table('dinar_investments')
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->get()
            ->map(function ($item) use ($userId) {
                $item->payments = DB::table('dinar_payments')
                    ->where('user_id', $userId)
                    ->where('dinar_investment_id', $item->id)
                    ->orderBy('installment_no')
                    ->get();

                $originalInvestment = max(0, (float) $item->investment_amount);
                $returnedPrincipal = (float) $item->payments
                    ->filter(fn ($payment) => (bool) $payment->is_paid)
                    ->sum(fn ($payment) => max(0, (float) $payment->total_principal));
                $returnedPrincipal = min($originalInvestment, $returnedPrincipal);
                $remainingInvestment = max(0, $originalInvestment - $returnedPrincipal);

                $item->original_investment_amount = round($originalInvestment, 2);
                $item->returned_principal = round($returnedPrincipal, 2);
                $item->remaining_investment_amount = round($remainingInvestment, 2);
                $item->is_principal_returned = $originalInvestment > 0 && $remainingInvestment <= 0.01;

                return $item;
            })
            ->values();

        $unlinked = DB::table('dinar_payments')
            ->where('user_id', $userId)
            ->whereNull('dinar_investment_id')
            ->orderByDesc('due_date')
            ->get();

        return response()->json([
            'data' => $items,
            'unlinked_payments' => $unlinked,
            'summary' => $this->tenantSummary($items, $unlinked),
        ]);
    }

    private function isAdmin(Request $request): bool
    {
        $user = $request->attributes->get('ahmed_user');
        if (Schema::hasColumn('users', 'is_admin')) {
            return (bool) ($user->is_admin ?? false);
        }

        return (int) ($user->id ?? 0) === (int) (DB::table('users')->orderBy('id')->value('id') ?: 0);
    }

    private function emptySummary(): array
    {
        return [
            'total_investment' => 0,
            'current_investment' => 0,
            'original_investment' => 0,
            'returned_principal' => 0,
            'expected_distributions' => 0,
            'linked_paid_distributions' => 0,
            'unlinked_paid_distributions' => 0,
            'paid_distributions' => 0,
            'remaining_distributions' => 0,
            'total_received' => 0,
            'opportunities_count' => 0,
            'active_opportunities_count' => 0,
            'completed_opportunities_count' => 0,
        ];
    }

    private function tenantSummary($items, $unlinked): array
    {
        $originalInvestment = 0;
        $returnedPrincipal = 0;
        $currentInvestment = 0;
        $expectedDistributions = 0;
        $linkedPaid = 0;
        $activeOpportunities = 0;

        foreach ($items as $item) {
            $itemOriginal = (float) ($item->original_investment_amount ?? $item->investment_amount);
            $itemReturned = (float) ($item->returned_principal ?? 0);
            $itemCurrent = (float) ($item->remaining_investment_amount ?? max(0, $itemOriginal - $itemReturned));

            $originalInvestment += $itemOriginal;
            $returnedPrincipal += $itemReturned;
            $currentInvestment += $itemCurrent;
            if ($itemCurrent > 0.01) {
                $activeOpportunities++;
            }

            foreach ($item->payments as $payment) {
                $expectedDistributions += (float) $payment->total_distribution;
                if ($payment->is_paid) {
                    $linkedPaid += (float) ($payment->paid_amount ?: $payment->total_distribution);
                }
            }
        }

        $unlinkedPaid = collect($unlinked)->sum(fn ($payment) => (float) ($payment->paid_amount ?: $payment->total_distribution));

        return [
            'total_investment' => round($currentInvestment, 2),
            'current_investment' => round($currentInvestment, 2),
            'original_investment' => round($originalInvestment, 2),
            'returned_principal' => round($returnedPrincipal, 2),
            'expected_distributions' => round($expectedDistributions, 2),
            'linked_paid_distributions' => round($linkedPaid, 2),
            'unlinked_paid_distributions' => round($unlinkedPaid, 2),
            'paid_distributions' => round($linkedPaid + $unlinkedPaid, 2),
            'remaining_distributions' => round(max(0, $expectedDistributions - $linkedPaid), 2),
            'total_received' => round($linkedPaid + $unlinkedPaid + $returnedPrincipal, 2),
            'opportunities_count' => count($items),
            'active_opportunities_count' => $activeOpportunities,
            'completed_opportunities_count' => max(0, count($items) - $activeOpportunities),
        ];
    }
}
