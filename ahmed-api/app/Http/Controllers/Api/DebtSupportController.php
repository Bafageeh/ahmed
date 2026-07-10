<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DebtGovernmentSupportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DebtSupportController extends Controller
{
    public function __construct(
        private DebtController $debts,
        private DebtGovernmentSupportService $support
    ) {
    }

    public function index(Request $request)
    {
        $userId = (int) $request->attributes->get('ahmed_user_id');
        $this->support->apply($userId);

        $response = $this->debts->index($request);
        $payload = $response->getData(true);

        if (Schema::hasColumn('debts', 'monthly_government_support')) {
            $supportByDebt = DB::table('debts')
                ->where('user_id', $userId)
                ->get()
                ->keyBy('id');

            $payload['data'] = collect($payload['data'] ?? [])->map(function ($item) use ($supportByDebt) {
                $debt = $supportByDebt->get($item['id'] ?? 0);
                return $debt ? $this->appendSupport($item, $debt) : $item;
            })->values()->all();
        }

        return response()->json($payload, $response->getStatusCode());
    }

    public function show(Request $request, int $id)
    {
        $userId = (int) $request->attributes->get('ahmed_user_id');
        $this->support->apply($userId, $id);

        $response = $this->debts->show($request, $id);
        $payload = $response->getData(true);

        if (($payload['data'] ?? null) && Schema::hasColumn('debts', 'monthly_government_support')) {
            $debt = DB::table('debts')
                ->where('id', $id)
                ->where('user_id', $userId)
                ->first();

            if ($debt) {
                $payload['data'] = $this->appendSupport($payload['data'], $debt, true);
            }
        }

        return response()->json($payload, $response->getStatusCode());
    }

    private function appendSupport(array $item, object $debt, bool $includeInstallmentTotals = false): array
    {
        $monthlySupport = (float) ($debt->monthly_government_support ?? 0);
        $previousSupportCount = (int) ($debt->previous_support_count ?? 0);
        $previousSupportTotal = (float) ($debt->previous_support_total ?? 0);
        $previousInstallmentsTotal = round(
            (float) ($debt->previous_installment_amount ?? 0) * (int) ($debt->previous_installments_count ?? 0),
            2
        );

        $item['monthly_government_support'] = round($monthlySupport, 2);
        $item['previous_support_count'] = $previousSupportCount;
        $item['previous_support_total'] = round($previousSupportTotal, 2);
        $item['previous_installments_total'] = $previousInstallmentsTotal;
        $item['previous_total_paid_with_support'] = round($previousInstallmentsTotal + $previousSupportTotal, 2);
        $item['government_support_enabled'] = $monthlySupport > 0;

        if ($includeInstallmentTotals && isset($item['installments']) && is_array($item['installments'])) {
            $currentMonth = now('Asia/Riyadh')->format('Y-m');
            $current = collect($item['installments'])->first(
                fn ($installment) => str_starts_with((string) ($installment['due_date'] ?? ''), $currentMonth)
            );

            $currentScheduled = (float) ($current['scheduled_amount'] ?? 0);
            $item['current_month_customer_share_after_support'] = round(
                max(0, $currentScheduled - $monthlySupport),
                2
            );
        }

        return $item;
    }
}
