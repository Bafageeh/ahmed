<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class LinkedIncomeController extends Controller
{
    private string $financeInstallmentsUrl = 'https://finance.pm.sa/api/v1/integrations/ahmed/installments-income';
    private string $financeSummaryUrl = 'https://finance.pm.sa/api/v1/integrations/ahmed/summary';

    public function index(): JsonResponse
    {
        $items = DB::table('financial_transactions')
            ->leftJoin('income_sources', 'financial_transactions.income_source_id', '=', 'income_sources.id')
            ->where('financial_transactions.transaction_type', 'linked_income')
            ->select([
                'financial_transactions.id',
                'financial_transactions.external_app_key',
                'financial_transactions.amount',
                'financial_transactions.currency',
                'financial_transactions.transaction_date',
                'financial_transactions.status',
                'financial_transactions.description',
                'financial_transactions.metadata',
                'financial_transactions.created_at',
                'income_sources.name as income_type',
            ])
            ->orderByDesc('financial_transactions.id')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function financeSummary(): JsonResponse
    {
        $response = $this->fetchFinanceSummary();

        if ($response instanceof JsonResponse) {
            return $response;
        }

        return response()->json(['data' => $response]);
    }

    public function syncFinanceSummary(): JsonResponse
    {
        $payload = $this->fetchFinanceSummary();

        if ($payload instanceof JsonResponse) {
            return $payload;
        }

        $this->upsertFinanceLink($this->financeSummaryUrl, 'finance_summary');

        $income = $payload['income'] ?? [];
        $portfolio = $payload['portfolio'] ?? [];
        $counts = $payload['counts'] ?? [];
        $alerts = $payload['alerts'] ?? [];
        $currency = $payload['currency'] ?? 'SAR';
        $transactionDate = data_get($payload, 'period.to', now()->toDateString());

        $metrics = [
            'monthly_installments_total' => ['group' => 'income', 'label' => 'مجموع الأقساط الشهرية', 'amount' => $income['monthly_installments_total'] ?? 0],
            'monthly_profit_total' => ['group' => 'income', 'label' => 'إجمالي الربح الشهري', 'amount' => $income['monthly_profit_total'] ?? 0],
            'ahmed_monthly_profit' => ['group' => 'income', 'label' => 'ربح أحمد الشهري', 'amount' => $income['ahmed_monthly_profit'] ?? 0],
            'ali_monthly_profit' => ['group' => 'income', 'label' => 'ربح علي الشهري', 'amount' => $income['ali_monthly_profit'] ?? 0],
            'remaining_installments_total' => ['group' => 'portfolio', 'label' => 'إجمالي المتبقي من الأقساط', 'amount' => $portfolio['remaining_installments_total'] ?? 0],
            'remaining_principal_total' => ['group' => 'portfolio', 'label' => 'رأس المال المتبقي', 'amount' => $portfolio['remaining_principal_total'] ?? 0],
            'ahmed_total_profit' => ['group' => 'portfolio', 'label' => 'إجمالي ربح أحمد', 'amount' => $portfolio['ahmed_total_profit'] ?? 0],
            'overdue_amount' => ['group' => 'alerts', 'label' => 'مبلغ الأقساط المتأخرة', 'amount' => $alerts['overdue_amount'] ?? 0],
        ];

        $sourceId = $this->incomeSourceId('ملخص Finance', $currency);
        $saved = [];

        foreach ($metrics as $key => $metric) {
            $reference = 'finance-summary-' . $key . '-' . $transactionDate;
            $saved[] = $this->upsertTransaction(
                $sourceId,
                $reference,
                $metric['label'],
                (float) $metric['amount'],
                $currency,
                $transactionDate,
                array_merge($metric, ['metric' => $key, 'payload' => $payload])
            );
        }

        return response()->json([
            'data' => [
                'summary' => $payload,
                'saved_metrics' => $saved,
                'counts' => $counts,
            ],
        ]);
    }

    public function syncFinanceInstallments(): JsonResponse
    {
        $response = Http::timeout(20)->acceptJson()->get($this->financeInstallmentsUrl);

        if (! $response->successful()) {
            return response()->json([
                'message' => 'تعذر جلب دخل الأقساط من Finance',
                'status' => $response->status(),
            ], 502);
        }

        $payload = $response->json('data') ?? [];
        $amount = round((float) ($payload['amount'] ?? 0), 2);
        $label = $payload['label'] ?? 'دخل الأقساط لأحمد من Finance';

        $this->upsertFinanceLink($this->financeInstallmentsUrl, 'ahmad_installments_income');

        $sourceId = $this->incomeSourceId($label, $payload['currency'] ?? 'SAR');
        $transactionDate = $payload['to'] ?? now()->toDateString();
        $reference = 'finance-ahmad-installments-' . ($payload['period'] ?? 'monthly') . '-' . $transactionDate;
        $id = $this->upsertTransaction($sourceId, $reference, $label, $amount, $payload['currency'] ?? 'SAR', $transactionDate, $payload);

        return response()->json([
            'data' => DB::table('financial_transactions')->where('id', $id)->first(),
            'source_payload' => $payload,
        ]);
    }

    private function fetchFinanceSummary(): array|JsonResponse
    {
        $response = Http::timeout(20)->acceptJson()->get($this->financeSummaryUrl);

        if (! $response->successful()) {
            return response()->json([
                'message' => 'تعذر جلب ملخص Finance',
                'status' => $response->status(),
            ], 502);
        }

        return $response->json('data') ?? [];
    }

    private function upsertFinanceLink(string $endpoint, string $metric): void
    {
        DB::table('external_app_links')->updateOrInsert(
            ['app_key' => 'finance'],
            [
                'name' => 'تطبيق Finance',
                'source_table' => 'finance_api',
                'sync_settings' => json_encode([
                    'endpoint' => $endpoint,
                    'metric' => $metric,
                ], JSON_UNESCAPED_UNICODE),
                'last_synced_at' => now(),
                'is_active' => true,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }

    private function incomeSourceId(string $label, string $currency): int
    {
        $sourceId = DB::table('income_sources')->where('linked_app_key', 'finance')->where('name', $label)->value('id');

        if ($sourceId) {
            return (int) $sourceId;
        }

        return DB::table('income_sources')->insertGetId([
            'name' => $label,
            'source_type' => 'linked_app',
            'linked_app_key' => 'finance',
            'default_currency' => $currency,
            'description' => 'مصدر بيانات مرتبط من تطبيق Finance',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function upsertTransaction(int $sourceId, string $reference, string $label, float $amount, string $currency, string $transactionDate, array $metadata): int
    {
        $existingId = DB::table('financial_transactions')
            ->where('external_app_key', 'finance')
            ->where('reference_number', $reference)
            ->value('id');

        $data = [
            'income_source_id' => $sourceId,
            'external_app_key' => 'finance',
            'reference_number' => $reference,
            'transaction_type' => 'linked_income',
            'direction' => 'in',
            'amount' => round($amount, 2),
            'currency' => $currency,
            'transaction_date' => $transactionDate,
            'status' => 'synced',
            'description' => $label,
            'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ];

        if ($existingId) {
            DB::table('financial_transactions')->where('id', $existingId)->update($data);
            return (int) $existingId;
        }

        $data['created_at'] = now();
        return DB::table('financial_transactions')->insertGetId($data);
    }
}
