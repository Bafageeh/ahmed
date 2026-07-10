<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CreditCardDebtController extends Controller
{
    public function index(Request $request)
    {
        $items = DB::table('credit_card_debts')
            ->where('user_id', $this->userId($request))
            ->orderBy('bank_name')
            ->orderBy('card_name')
            ->orderBy('id')
            ->get()
            ->map(fn ($item) => $this->normalize($item));

        $total = $items->sum(fn ($item) => (float) $item['credit_limit']);
        $count = $items->count();
        $highest = $items->sortByDesc('credit_limit')->first();

        return response()->json([
            'data' => $items->values(),
            'summary' => [
                'cards_count' => $count,
                'total_debt' => round($total, 2),
                'highest_limit' => $highest ? round((float) $highest['credit_limit'], 2) : 0,
                'highest_card' => $highest,
                'average_limit' => $count > 0 ? round($total / $count, 2) : 0,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);
        $now = now();

        $id = DB::table('credit_card_debts')->insertGetId([
            'user_id' => $this->userId($request),
            'bank_name' => $data['bank_name'],
            'card_name' => $data['card_name'],
            'credit_limit' => $data['credit_limit'],
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'data' => $this->normalize(DB::table('credit_card_debts')->where('id', $id)->first()),
            'message' => 'تمت إضافة البطاقة',
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $item = $this->findOwned($request, $id);
        if (! $item) {
            return response()->json(['message' => 'البطاقة غير موجودة'], 404);
        }

        $data = $this->validateData($request);

        DB::table('credit_card_debts')
            ->where('id', $id)
            ->update([
                'bank_name' => $data['bank_name'],
                'card_name' => $data['card_name'],
                'credit_limit' => $data['credit_limit'],
                'updated_at' => now(),
            ]);

        return response()->json([
            'data' => $this->normalize(DB::table('credit_card_debts')->where('id', $id)->first()),
            'message' => 'تم تحديث البطاقة',
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $item = $this->findOwned($request, $id);
        if (! $item) {
            return response()->json(['message' => 'البطاقة غير موجودة'], 404);
        }

        DB::table('credit_card_debts')->where('id', $id)->delete();

        return response()->json(['message' => 'تم حذف البطاقة']);
    }

    private function validateData(Request $request): array
    {
        $data = $request->validate([
            'bank_name' => ['required', 'string', 'max:120'],
            'card_name' => ['required', 'string', 'max:120'],
            'credit_limit' => ['required', 'numeric', 'min:0.01', 'max:999999999999.99'],
        ]);

        return [
            'bank_name' => trim($data['bank_name']),
            'card_name' => trim($data['card_name']),
            'credit_limit' => round((float) $data['credit_limit'], 2),
        ];
    }

    private function findOwned(Request $request, int $id): ?object
    {
        return DB::table('credit_card_debts')
            ->where('id', $id)
            ->where('user_id', $this->userId($request))
            ->first();
    }

    private function normalize(object $item): array
    {
        return [
            'id' => (int) $item->id,
            'user_id' => (int) $item->user_id,
            'bank_name' => $item->bank_name,
            'card_name' => $item->card_name,
            'credit_limit' => round((float) $item->credit_limit, 2),
            'created_at' => $item->created_at,
            'updated_at' => $item->updated_at,
        ];
    }

    private function userId(Request $request): int
    {
        return (int) $request->attributes->get('ahmed_user_id');
    }
}
