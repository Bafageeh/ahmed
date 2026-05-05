<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

    public function syncFinanceMetric(Request $request): JsonResponse
    {
        $data = $request->validate([
            'key' => ['required', 'string', 'max:100'],
            'label' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric'],
            'group' => ['nullable', 'string', 'max:100'],
            'currency' => ['nullable', 'string', 'max:10'],
            'transaction_date' => ['nullable', 'date'],
        ]);

        $currency = $data['currency'] ?? 'SAR';
        $transactionDate = $data['transaction_date'] ?? now()->toDateString();
        $sourceId = $this->incomeSourceId('Finance - ' . $data['label'], $currency, 'finance');
        $reference = 'finance-card-' . $data['key'] . '-' . $transactionDate;

        $id = $this->upsertTransaction(
            $sourceId,
            'finance',
            $reference,
            $data['label'],
            (float) $data['amount'],
            $currency,
            $transactionDate,
            [
                'source' => 'finance_card_button',
                'metric' => $data['key'],
                'group' => $data['group'] ?? null,
                'label' => $data['label'],
            ]
        );

        return response()->json(['data' => DB::table('financial_transactions')->where('id', $id)->first()]);
    }

    public function syncMoneyMoonProfits(): JsonResponse
    {
        $platformId = DB::table('investment_platforms')->where('code', 'moneymoon')->value('id');

        if (! $platformId) {
            return response()->json(['message' => 'MoneyMoon platform not found'], 404);
        }

        $sourceId = $this->incomeSourceId('أرباح موني مون', 'SAR', 'moneymoon');
        $investments = DB::table('investment_opportunities')
            ->where('platform_id', $platformId)
            ->where('investment_type', 'moneymoon')
            ->where('expected_profit_amount', '>', 0)
            ->orderByDesc('id')
            ->get();

        $saved = [];

        foreach ($investments as $investment) {
            $metadata = $this->metadata($investment->metadata ?? null);
            $orderNo = $this->orderNumber($investment, $metadata) ?: ('investment-' . $investment->id);
            $transactionDate = $investment->maturity_date ?: $investment->start_date ?: now()->toDateString();
            $label = 'ربح موني مون - ' . $orderNo;
            $reference = 'moneymoon-profit-' . $orderNo;

            $saved[] = $this->upsertTransaction(
                $sourceId,
                'moneymoon',
                $reference,
                $label,
                (float) $investment->expected_profit_amount,
                'SAR',
                $transactionDate,
                [
                    'source' => 'moneymoon_profit_auto',
                    'investment_id' => $investment->id,
                    'order_no' => $orderNo,
                    'category' => $metadata['category'] ?? null,
                    'profit_rate' => $investment->expected_rate ?? ($metadata['profit_rate'] ?? null),
                    'principal_amount' => $investment->principal_amount,
                    'maturity_date' => $investment->maturity_date,
                    'status' => $investment->status,
                ]
            );
        }

        return response()->json([
            'data' => [
                'saved_count' => count($saved),
                'saved_ids' => $saved,
            ],
        ]);
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

        $sourceId = $this->incomeSourceId('ملخص Finance', $currency, 'finance');
        $saved = [];

        foreach ($metrics as $key => $metric) {
            $reference = 'finance-summary-' . $key . '-' . $transactionDate;
            $saved[] = $this->upsertTransaction(
                $sourceId,
                'finance',
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

        $sourceId = $this->incomeSourceId($label, $payload['currency'] ?? 'SAR', 'finance');
        $transactionDate = $payload['to'] ?? now()->toDateString();
        $reference = 'finance-ahmad-installments-' . ($payload['period'] ?? 'monthly') . '-' . $transactionDate;
        $id = $this->upsertTransaction($sourceId, 'finance', $reference, $label, $amount, $payload['currency'] ?? 'SAR', $transactionDate, $payload);

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

    private function incomeSourceId(string $label, string $currency, string $linkedAppKey): int
    {
        $sourceId = DB::table('income_sources')->where('linked_app_key', $linkedAppKey)->where('name', $label)->value('id');

        if ($sourceId) {
            return (int) $sourceId;
        }

        return DB::table('income_sources')->insertGetId([
            'name' => $label,
            'source_type' => 'linked_app',
            'linked_app_key' => $linkedAppKey,
            'default_currency' => $currency,
            'description' => 'مصدر بيانات مرتبط من ' . $linkedAppKey,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function upsertTransaction(int $sourceId, string $externalAppKey, string $reference, string $label, float $amount, string $currency, string $transactionDate, array $metadata): int
    {
        $existingId = DB::table('financial_transactions')
            ->where('external_app_key', $externalAppKey)
            ->where('reference_number', $reference)
            ->value('id');

        $data = [
            'income_source_id' => $sourceId,
            'external_app_key' => $externalAppKey,
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

    private function metadata($value): array
    {
        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function orderNumber(object $investment, array $metadata): string
    {
        foreach (['external_order_no', 'order_no', 'order_number'] as $key) {
            if (! empty($metadata[$key])) {
                return trim((string) $metadata[$key]);
            }
        }

        foreach ([$investment->title ?? '', $investment->notes ?? ''] as $value) {
            if (preg_match('/L-[A-Za-z0-9-]+/', (string) $value, $matches)) {
                return trim($matches[0]);
            }
        }

        return '';
    }
}
