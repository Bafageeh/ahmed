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
        $payload = $this->fetchFinanceSummary();

        if ($payload instanceof JsonResponse) {
            return $payload;
        }

        return response()->json(['data' => $this->financeViewData($payload)]);
    }

    public function updateFinanceVisibility(Request $request): JsonResponse
    {
        $data = $request->validate([
            'key' => ['required', 'string', 'max:100'],
            'visible' => ['required', 'boolean'],
        ]);

        if (! array_key_exists($data['key'], $this->financeMetricDefinitions())) {
            return response()->json(['message' => 'Unknown Finance metric'], 422);
        }

        $settings = $this->financeVisibilitySettings();
        $settings[$data['key']] = (bool) $data['visible'];
        $this->saveFinanceVisibilitySettings($settings);

        return response()->json(['data' => ['visible_metrics' => $settings]]);
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
            ->get();

        $totalProfit = round((float) $investments->sum(fn ($investment) => (float) $investment->expected_profit_amount), 2);
        $investmentCount = $investments->count();
        $transactionDate = now()->toDateString();
        $reference = 'moneymoon-profits-total';
        $label = 'إجمالي أرباح موني مون';

        DB::table('financial_transactions')
            ->where('external_app_key', 'moneymoon')
            ->where(function ($query) use ($reference) {
                $query->where('reference_number', 'like', 'moneymoon-profit-%')
                    ->orWhere('reference_number', $reference);
            })
            ->delete();

        $savedId = null;

        if ($totalProfit > 0) {
            $savedId = $this->upsertTransaction($sourceId, 'moneymoon', $reference, $label, $totalProfit, 'SAR', $transactionDate, [
                'source' => 'moneymoon_profit_total_auto',
                'investment_count' => $investmentCount,
                'total_expected_profit' => $totalProfit,
                'aggregation' => 'one_card_total',
                'synced_at' => now()->toDateTimeString(),
            ]);
        }

        return response()->json([
            'data' => [
                'saved_count' => $savedId ? 1 : 0,
                'saved_ids' => $savedId ? [$savedId] : [],
                'total_profit' => $totalProfit,
                'investment_count' => $investmentCount,
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

        $viewData = $this->financeViewData($payload);
        $currency = $viewData['currency'] ?? 'SAR';
        $transactionDate = data_get($payload, 'period.to', now()->toDateString());
        $sourceId = $this->incomeSourceId('Finance', $currency, 'finance');
        $saved = [];

        foreach ($viewData['metrics'] as $metric) {
            $reference = 'finance-summary-' . $metric['key'] . '-' . $transactionDate;
            $saved[] = $this->upsertTransaction($sourceId, 'finance', $reference, $metric['title'], (float) $metric['amount'], $currency, $transactionDate, [
                'source' => 'finance_summary',
                'source_email' => 'admin@pm.sa',
                'metric' => $metric['key'],
                'path' => $metric['path'],
                'type' => $metric['type'],
                'description' => $metric['description'] ?? null,
                'details' => $metric['details'] ?? [],
                'synced_at' => $viewData['synced_at'],
            ]);
        }

        return response()->json([
            'data' => [
                'summary' => $viewData,
                'saved_metrics' => $saved,
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
                'message' => 'تعذر جلب بيانات Finance',
                'status' => $response->status(),
            ], 502);
        }

        return $response->json('data') ?? [];
    }

    private function financeViewData(array $payload): array
    {
        $visibility = $this->financeVisibilitySettings();
        $metrics = [];

        foreach ($this->financeMetricDefinitions() as $key => $definition) {
            $details = [];

            foreach (($definition['details'] ?? []) as $detail) {
                $details[] = [
                    'path' => $detail['path'],
                    'title' => $detail['title'],
                    'amount' => round((float) data_get($payload, $detail['path'], 0), 2),
                    'currency' => $payload['currency'] ?? 'SAR',
                ];
            }

            $metrics[] = [
                'key' => $key,
                'path' => $definition['path'],
                'title' => $definition['title'],
                'description' => $definition['description'] ?? null,
                'type' => $definition['type'],
                'group' => $definition['group'],
                'amount' => round((float) data_get($payload, $definition['path'], 0), 2),
                'currency' => $payload['currency'] ?? 'SAR',
                'source' => 'Finance',
                'source_email' => 'admin@pm.sa',
                'editable' => false,
                'visible' => $visibility[$key] ?? true,
                'details' => $details,
            ];
        }

        return [
            'source' => 'Finance',
            'source_email' => 'admin@pm.sa',
            'endpoint' => $this->financeSummaryUrl,
            'currency' => $payload['currency'] ?? 'SAR',
            'synced_at' => $payload['synced_at'] ?? null,
            'period' => $payload['period'] ?? null,
            'metrics' => $metrics,
            'visible_metrics' => $visibility,
        ];
    }

    private function financeMetricDefinitions(): array
    {
        return [
            'monthly_installments_total' => [
                'path' => 'income.monthly_installments_total',
                'title' => 'مجموع الأقساط الشهرية',
                'type' => 'دخل مستورد من Finance',
                'group' => 'income',
            ],
            'ahmed_monthly_profit' => [
                'path' => 'income.ahmed_monthly_profit',
                'title' => 'ربح أحمد الشهري',
                'type' => 'دخل مستورد من Finance',
                'group' => 'income',
            ],
            'remaining_installments_total' => [
                'path' => 'portfolio.remaining_installments_total',
                'title' => 'إجمالي المتبقي من الأقساط',
                'type' => 'محفظة / تمويل',
                'group' => 'portfolio',
            ],
            'remaining_principal_total' => [
                'path' => 'portfolio.remaining_principal_total',
                'title' => 'رأس المال المتبقي',
                'type' => 'محفظة / تمويل',
                'group' => 'portfolio',
            ],
            'ahmed_total_profit' => [
                'path' => 'portfolio.ahmed_total_profit',
                'title' => 'إجمالي ربح أحمد من العملاء النشطين',
                'type' => 'محفظة / تمويل',
                'group' => 'portfolio',
            ],
            'ahmed_net_profit_after_stuck_deduction' => [
                'path' => 'portfolio.ahmed_net_profit_after_stuck_deduction',
                'title' => 'صافي ربح أحمد بعد خصم المتعثرين',
                'description' => 'إجمالي ربح أحمد من العملاء النشطين مطروحًا منه ربح أحمد من العملاء المتعثرين.',
                'type' => 'قيمة مستوردة من Finance',
                'group' => 'portfolio',
                'details' => [
                    [
                        'path' => 'portfolio.ahmed_total_profit',
                        'title' => 'إجمالي ربح أحمد من العملاء النشطين',
                    ],
                    [
                        'path' => 'portfolio.ahmed_stuck_profit_deduction',
                        'title' => 'خصم ربح العملاء المتعثرين',
                    ],
                ],
            ],
        ];
    }

    private function financeVisibilitySettings(): array
    {
        $settings = DB::table('external_app_links')->where('app_key', 'finance')->value('sync_settings');
        $decoded = json_decode((string) $settings, true);
        $visibility = is_array($decoded) ? ($decoded['visible_metrics'] ?? []) : [];

        return is_array($visibility) ? $visibility : [];
    }

    private function saveFinanceVisibilitySettings(array $visibility): void
    {
        DB::table('external_app_links')->updateOrInsert(
            ['app_key' => 'finance'],
            [
                'name' => 'Finance',
                'source_table' => 'finance_api',
                'sync_settings' => json_encode([
                    'endpoint' => $this->financeSummaryUrl,
                    'metric' => 'finance_summary',
                    'source_email' => 'admin@pm.sa',
                    'visible_metrics' => $visibility,
                ], JSON_UNESCAPED_UNICODE),
                'last_synced_at' => now(),
                'is_active' => true,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }

    private function upsertFinanceLink(string $endpoint, string $metric): void
    {
        $existingSettings = DB::table('external_app_links')->where('app_key', 'finance')->value('sync_settings');
        $decoded = json_decode((string) $existingSettings, true);
        $visibleMetrics = is_array($decoded) ? ($decoded['visible_metrics'] ?? []) : [];

        DB::table('external_app_links')->updateOrInsert(
            ['app_key' => 'finance'],
            [
                'name' => 'Finance',
                'source_table' => 'finance_api',
                'sync_settings' => json_encode([
                    'endpoint' => $endpoint,
                    'metric' => $metric,
                    'source_email' => 'admin@pm.sa',
                    'visible_metrics' => $visibleMetrics,
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
