<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PersonalExpenseController extends Controller
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);

        $items = DB::table('personal_expenses')
            ->where('user_id', $userId)
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($item) => $this->normalize($item));

        return response()->json([
            'data' => $items,
            'summary' => $this->summary($items),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $id = DB::table('personal_expenses')->insertGetId([
            'user_id' => $this->userId($request),
            'definition' => $data['definition'],
            'amount' => $data['amount'],
            'expense_date' => $data['expense_date'],
            'frequency' => $data['frequency'],
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $item = DB::table('personal_expenses')->where('id', $id)->first();

        return response()->json(['data' => $this->normalize($item)], 201);
    }

    public function update(Request $request, int $id)
    {
        $data = $this->validated($request);
        $userId = $this->userId($request);

        $updated = DB::table('personal_expenses')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->update([
                'definition' => $data['definition'],
                'amount' => $data['amount'],
                'expense_date' => $data['expense_date'],
                'frequency' => $data['frequency'],
                'notes' => $data['notes'] ?? null,
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'المصروف غير موجود'], 404);
        }

        $item = DB::table('personal_expenses')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        return response()->json(['data' => $this->normalize($item)]);
    }

    public function destroy(Request $request, int $id)
    {
        $deleted = DB::table('personal_expenses')
            ->where('id', $id)
            ->where('user_id', $this->userId($request))
            ->delete();

        return response()->json(['data' => ['deleted' => (bool) $deleted]]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'definition' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
            'expense_date' => ['required', 'date'],
            'frequency' => ['required', Rule::in(['monthly', 'annual'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function userId(Request $request): int
    {
        return (int) $request->attributes->get('ahmed_user_id');
    }

    private function normalize(object $item): array
    {
        $amount = (float) $item->amount;
        $frequency = (string) $item->frequency;

        return [
            'id' => $item->id,
            'user_id' => $item->user_id,
            'definition' => $item->definition,
            'amount' => round($amount, 2),
            'expense_date' => $item->expense_date,
            'frequency' => $frequency,
            'notes' => $item->notes,
            'monthly_equivalent' => round($this->monthlyEquivalent($amount, $frequency), 2),
            'annual_equivalent' => round($this->annualEquivalent($amount, $frequency), 2),
            'created_at' => $item->created_at,
            'updated_at' => $item->updated_at,
        ];
    }

    private function summary($items): array
    {
        $monthly = $items->sum(fn ($item) => (float) $item['monthly_equivalent']);
        $annual = $items->sum(fn ($item) => (float) $item['annual_equivalent']);

        return [
            'count' => $items->count(),
            'monthly_total' => round($monthly, 2),
            'annual_total' => round($annual, 2),
        ];
    }

    private function monthlyEquivalent(float $amount, string $frequency): float
    {
        return $frequency === 'annual' ? $amount / 12 : $amount;
    }

    private function annualEquivalent(float $amount, string $frequency): float
    {
        return $frequency === 'annual' ? $amount : $amount * 12;
    }
}
