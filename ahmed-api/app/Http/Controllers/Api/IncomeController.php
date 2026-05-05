<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IncomeController extends Controller
{
    public function index()
    {
        $items = DB::table('financial_transactions')
            ->leftJoin('income_sources', 'financial_transactions.income_source_id', '=', 'income_sources.id')
            ->whereIn('financial_transactions.transaction_type', ['basic_income', 'linked_income'])
            ->select([
                'financial_transactions.id',
                'financial_transactions.external_app_key',
                'financial_transactions.transaction_type',
                'financial_transactions.amount',
                'financial_transactions.currency',
                'financial_transactions.transaction_date',
                'financial_transactions.status',
                'financial_transactions.description',
                'financial_transactions.metadata',
                'financial_transactions.created_at',
                'income_sources.source_type',
                'income_sources.linked_app_key',
                'income_sources.name as income_type',
            ])
            ->orderByDesc('financial_transactions.id')
            ->get()
            ->map(function ($item) {
                $isLinked = $item->transaction_type === 'linked_income';

                if ($isLinked) {
                    $item->income_type = ($item->income_type ?: 'دخل مرتبط') . ' - مرتبط';
                    $item->readonly = true;
                    $item->display_source = $item->external_app_key ?: $item->linked_app_key ?: 'external';
                } else {
                    $item->readonly = false;
                    $item->display_source = 'manual';
                }

                return $item;
            });

        return response()->json(['data' => $items]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'income_type' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string'],
        ]);

        $sourceId = DB::table('income_sources')->where('name', $data['income_type'])->value('id');

        if (! $sourceId) {
            $sourceId = DB::table('income_sources')->insertGetId([
                'name' => $data['income_type'],
                'source_type' => 'basic',
                'default_currency' => 'SAR',
                'description' => 'مصدر دخل أساسي مدخل من التطبيق',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $id = DB::table('financial_transactions')->insertGetId([
            'income_source_id' => $sourceId,
            'transaction_type' => 'basic_income',
            'direction' => 'in',
            'amount' => $data['amount'],
            'currency' => 'SAR',
            'transaction_date' => now()->toDateString(),
            'status' => 'settled',
            'description' => $data['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('financial_transactions')->where('id', $id)->first()], 201);
    }

    public function destroy(int $id)
    {
        $transaction = DB::table('financial_transactions')
            ->where('id', $id)
            ->where('transaction_type', 'basic_income')
            ->first();

        if (! $transaction) {
            return response()->json(['message' => 'Basic income transaction not found'], 404);
        }

        DB::table('financial_transactions')->where('id', $id)->delete();

        return response()->json([
            'ok' => true,
            'message' => 'Basic income deleted successfully',
            'deleted_id' => $id,
        ]);
    }
}
