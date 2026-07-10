<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class MonthlyIncomeController extends Controller
{
    private string $comSummaryUrl = 'https://com.pm.sa/api/v1/integrations/ahmed/summary/';

    public function index(Request $request)
    {
        $screen = $this->screenKey($request, $request->query('screen', 'future'));

        $items = DB::table('monthly_incomes')
            ->where('screen', $screen)
            ->orderByDesc('id')
            ->get();

        if ($screen === 'future') {
            $items->prepend((object) [
                'id' => 'fixed-com-monthly-person-net',
                'screen' => 'future',
                'name' => 'صافي الشخص الشهري من COM',
                'amount' => $this->fetchComMonthlyPersonNet(),
                'readonly' => true,
                'display_source' => 'com',
                'external_app_key' => 'com',
                'source_key' => 'com_monthly_person_net',
                'created_at' => null,
                'updated_at' => now()->toDateTimeString(),
            ]);
        }

        return response()->json(['data' => $items->values()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'screen' => ['nullable', 'string'],
            'name' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        $screen = $this->screenKey($request, $data['screen'] ?? 'future');

        $id = DB::table('monthly_incomes')->insertGetId([
            'screen' => $screen,
            'name' => $data['name'],
            'amount' => $data['amount'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('monthly_incomes')->where('id', $id)->first()]);
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        DB::table('monthly_incomes')->where('id', $id)->update([
            'name' => $data['name'],
            'amount' => $data['amount'],
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('monthly_incomes')->where('id', $id)->first()]);
    }

    public function destroy(int|string $id)
    {
        if ($id === 'fixed-com-monthly-person-net') {
            return response()->json(['data' => ['deleted' => false, 'readonly' => true]]);
        }

        DB::table('monthly_incomes')->where('id', $id)->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }

    private function screenKey(Request $request, string $screen): string
    {
        if ($screen !== 'wealth') {
            return $screen;
        }

        $userId = (int) $request->header('X-Ahmed-User-Id', 1);
        if ($userId <= 0) {
            $userId = 1;
        }

        return "wealth-{$userId}";
    }

    private function fetchComMonthlyPersonNet(): float
    {
        try {
            $response = Http::timeout(10)->acceptJson()->get($this->comSummaryUrl);
            $json = $response->json();
            $data = is_array($json) ? ($json['data'] ?? $json) : [];
            $income = is_array($data['income'] ?? null) ? $data['income'] : [];
            $value = $income['com_monthly_person_net'] ?? $data['com_monthly_person_net'] ?? null;

            if (is_numeric($value)) {
                return round((float) $value, 2);
            }
        } catch (\Throwable $exception) {
            // keep fallback below
        }

        return 614.95;
    }
}
