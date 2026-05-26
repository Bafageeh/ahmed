<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class MonthlyIncomeController extends Controller
{
    private array $comSummaryUrls = [
        'https://com.pm.sa/api/v1/integrations/ahmed/summary',
        'https://com.pm.sa/api/integrations/ahmed/summary',
    ];

    private array $comMonthlyPersonNetPaths = [
        'income.com_monthly_person_net',
        'person.com_monthly_person_net',
        'portfolio.com_monthly_person_net',
        'com_monthly_person_net',
    ];

    public function index(Request $request)
    {
        $screen = $request->query('screen', 'future');

        $items = DB::table('monthly_incomes')
            ->where('screen', $screen)
            ->orderByDesc('id')
            ->get();

        if ($screen === 'future') {
            $comAmount = $this->fetchComMonthlyPersonNet();

            if ($comAmount > 0) {
                $items->prepend((object) [
                    'id' => 'fixed-com-monthly-person-net',
                    'screen' => 'future',
                    'name' => 'صافي الشخص الشهري',
                    'amount' => $comAmount,
                    'readonly' => true,
                    'display_source' => 'com',
                    'external_app_key' => 'com',
                    'source_key' => 'com_monthly_person_net',
                    'created_at' => null,
                    'updated_at' => now()->toDateTimeString(),
                ]);
            }
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

        $id = DB::table('monthly_incomes')->insertGetId([
            'screen' => $data['screen'] ?? 'future',
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

    private function fetchComMonthlyPersonNet(): float
    {
        foreach ($this->comSummaryUrls as $url) {
            try {
                $response = Http::timeout(12)->acceptJson()->get($url);

                if (! $response->successful()) {
                    continue;
                }

                $payload = $response->json('data') ?? $response->json() ?? [];
                $amount = $this->pickNumber($payload, $this->comMonthlyPersonNetPaths);

                if ($amount > 0) {
                    return $amount;
                }
            } catch (\Throwable $exception) {
                continue;
            }
        }

        return 0.0;
    }

    private function pickNumber(array $payload, array $paths): float
    {
        foreach ($paths as $path) {
            $value = data_get($payload, $path);

            if ($value !== null && $value !== '') {
                $number = (float) $value;
                return is_finite($number) ? $number : 0.0;
            }
        }

        return 0.0;
    }
}
