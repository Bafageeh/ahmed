<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class MonthlyIncomeController extends Controller
{
    private string $comBaseUrl = 'https://com.pm.sa/api';

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
        $summaryAmount = $this->fetchComSummaryMonthlyPersonNet();

        if ($summaryAmount !== null && abs($summaryAmount) > 0.0001) {
            return $summaryAmount;
        }

        return $this->calculateComMonthlyPersonNetFromCurrentApis();
    }

    private function fetchComSummaryMonthlyPersonNet(): ?float
    {
        foreach ($this->comSummaryUrls as $url) {
            try {
                $response = Http::timeout(12)->acceptJson()->get($url);

                if (! $response->successful()) {
                    continue;
                }

                $payload = $response->json('data') ?? $response->json() ?? [];
                return $this->pickNumber($payload, $this->comMonthlyPersonNetPaths);
            } catch (\Throwable $exception) {
                continue;
            }
        }

        return null;
    }

    private function calculateComMonthlyPersonNetFromCurrentApis(): float
    {
        try {
            $hostingsResponse = Http::timeout(15)->acceptJson()->get($this->comBaseUrl . '/hostings');
            $expensesResponse = Http::timeout(15)->acceptJson()->get($this->comBaseUrl . '/expenses');

            if (! $hostingsResponse->successful() || ! $expensesResponse->successful()) {
                return 0.0;
            }

            $hostings = $hostingsResponse->json('data') ?? [];
            $expenses = $expensesResponse->json('data') ?? [];

            if (! is_array($hostings)) {
                $hostings = [];
            }

            if (! is_array($expenses)) {
                $expenses = [];
            }

            $domainRenewalAnnual = collect($hostings)->sum(fn ($hosting) => $this->pickFirstNumber($hosting, [
                'domain_renewal_cost_sar', 'domain_renewal_cost', 'domain_cost_sar', 'domain_cost', 'renewal_cost_sar', 'domain_renewal_price', 'domain_price',
            ]));

            $hostingIncomeAnnual = collect($hostings)->sum(fn ($hosting) => $this->pickFirstNumber($hosting, [
                'hosting_cost_sar', 'hosting_cost', 'hosting_renewal_cost_sar', 'hosting_renewal_cost', 'hosting_price', 'host_cost_sar', 'host_cost',
            ]));

            $manualExpensesAnnual = collect($expenses)->sum(fn ($expense) => $this->annualExpenseAmount($expense));
            $annualExpenses = $manualExpensesAnnual + $domainRenewalAnnual;
            $annualNet = $hostingIncomeAnnual - $annualExpenses;

            return round($annualNet / 24, 2);
        } catch (\Throwable $exception) {
            return 0.0;
        }
    }

    private function annualExpenseAmount(mixed $expense): float
    {
        $amount = $this->numberValue(data_get($expense, 'amount_sar'));
        $cycle = strtolower((string) (data_get($expense, 'billing_cycle') ?? 'yearly'));

        return in_array($cycle, ['monthly', 'شهري'], true) ? $amount * 12 : $amount;
    }

    private function pickNumber(array $payload, array $paths): float
    {
        foreach ($paths as $path) {
            $value = data_get($payload, $path);

            if ($value !== null && $value !== '') {
                return $this->numberValue($value);
            }
        }

        return 0.0;
    }

    private function pickFirstNumber(mixed $source, array $keys): float
    {
        foreach ($keys as $key) {
            $value = data_get($source, $key);
            $number = $this->numberValue($value);

            if ($number !== 0.0) {
                return $number;
            }
        }

        return 0.0;
    }

    private function numberValue(mixed $value): float
    {
        if ($value === null || $value === '') {
            return 0.0;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        return (float) str_replace(',', '', (string) $value);
    }
}
