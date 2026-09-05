<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IncomeController extends Controller
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);

        $items = DB::table('financial_transactions')
            ->leftJoin('income_sources', function ($join) use ($userId) {
                $join->on('financial_transactions.income_source_id', '=', 'income_sources.id')
                    ->where('income_sources.user_id', '=', $userId);
            })
            ->where('financial_transactions.user_id', $userId)
            ->whereIn('financial_transactions.transaction_type', ['basic_income', 'linked_income'])
            ->select([
                'financial_transactions.id',
                'financial_transactions.external_app_key',
                'financial_transactions.reference_number',
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
                    $item->readonly = false;
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

        $userId = $this->userId($request);
        $sourceId = DB::table('income_sources')
            ->where('user_id', $userId)
            ->where('name', $data['income_type'])
            ->value('id');

        if (! $sourceId) {
            $sourceId = DB::table('income_sources')->insertGetId([
                'user_id' => $userId,
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
            'user_id' => $userId,
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

        return response()->json([
            'data' => DB::table('financial_transactions')
                ->where('id', $id)
                ->where('user_id', $userId)
                ->first(),
        ], 201);
    }

    public function destroy(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $transaction = DB::table('financial_transactions')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->whereIn('transaction_type', ['basic_income', 'linked_income'])
            ->first();

        if (! $transaction) {
            return response()->json(['message' => 'Income transaction not found'], 404);
        }

        DB::table('financial_transactions')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->delete();

        return response()->json([
            'ok' => true,
            'message' => 'Income deleted successfully',
            'deleted_id' => $id,
        ]);
    }

    private function userId(Request $request): int
    {
        $userId = (int) $request->attributes->get('ahmed_user_id', 0);
        abort_unless($userId > 0, 401, 'يجب تسجيل الدخول أولاً');
        return $userId;
    }
}
