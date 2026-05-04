<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class LinkedIncomeController extends Controller
{
    private string $financeUrl = 'https://finance.pm.sa/api/v1/integrations/ahmed/installments-income';

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

    public function syncFinanceInstallments(): JsonResponse
    {
        $response = Http::timeout(20)->acceptJson()->get($this->financeUrl);

        if (! $response->successful()) {
            return response()->json([
                'message' => 'تعذر جلب دخل الأقساط من Finance',
                'status' => $response->status(),
            ], 502);
        }

        $payload = $response->json('data') ?? [];
        $amount = round((float) ($payload['amount'] ?? 0), 2);
        $label = $payload['label'] ?? 'دخل الأقساط لأحمد من Finance';

        $linkId = DB::table('external_app_links')->updateOrInsert(
            ['app_key' => 'finance'],
            [
                'name' => 'تطبيق Finance',
                'source_table' => 'finance_api',
                'sync_settings' => json_encode([
                    'endpoint' => $this->financeUrl,
                    'metric' => 'ahmad_installments_income',
                ], JSON_UNESCAPED_UNICODE),
                'last_synced_at' => now(),
                'is_active' => true,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        $sourceId = DB::table('income_sources')->where('linked_app_key', 'finance')->where('name', $label)->value('id');

        if (! $sourceId) {
            $sourceId = DB::table('income_sources')->insertGetId([
                'name' => $label,
                'source_type' => 'linked_app',
                'linked_app_key' => 'finance',
                'default_currency' => $payload['currency'] ?? 'SAR',
                'description' => 'مصدر دخل مرتبط من تطبيق Finance',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $transactionDate = $payload['to'] ?? now()->toDateString();
        $reference = 'finance-ahmad-installments-' . ($payload['period'] ?? 'monthly') . '-' . $transactionDate;

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
            'amount' => $amount,
            'currency' => $payload['currency'] ?? 'SAR',
            'transaction_date' => $transactionDate,
            'status' => 'synced',
            'description' => $label,
            'metadata' => json_encode($payload, JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ];

        if ($existingId) {
            DB::table('financial_transactions')->where('id', $existingId)->update($data);
            $id = $existingId;
        } else {
            $data['created_at'] = now();
            $id = DB::table('financial_transactions')->insertGetId($data);
        }

        return response()->json([
            'data' => DB::table('financial_transactions')->where('id', $id)->first(),
            'source_payload' => $payload,
        ]);
    }
}
