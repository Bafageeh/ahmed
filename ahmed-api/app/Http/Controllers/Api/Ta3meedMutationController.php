<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class Ta3meedMutationController extends Controller
{
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:100'],
            'total_amount' => ['required', 'numeric', 'min:0'],
            'profit' => ['nullable', 'numeric', 'min:0'],
            'profit_rate' => ['nullable', 'numeric', 'min:0'],
            'category' => ['nullable', 'string', 'max:50'],
            'months' => ['nullable', 'integer', 'min:1'],
            'start_date' => ['nullable', 'date'],
            'maturity_date' => ['nullable', 'date'],
            'returned_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'allocations' => ['nullable', 'array'],
            'allocations.*.investor' => ['required_with:allocations', 'string', 'max:100'],
            'allocations.*.amount' => ['required_with:allocations', 'numeric', 'min:0'],
        ]);

        $platform = $this->platform();
        if (! $platform) {
            return response()->json(['message' => 'Ta3meed platform not found'], 404);
        }

        $investment = DB::table('investment_opportunities')
            ->where('id', $id)
            ->where('platform_id', $platform->id)
            ->first();

        if (! $investment) {
            return response()->json(['message' => 'Investment not found'], 404);
        }

        $totalAmount = round((float) $data['total_amount'], 2);
        $profit = round((float) ($data['profit'] ?? 0), 2);
        $rate = $data['profit_rate'] ?? ($totalAmount > 0 ? round(($profit / $totalAmount) * 100, 4) : null);
        $meta = $this->meta($data, $investment->metadata);

        DB::table('investment_opportunities')
            ->where('id', $id)
            ->update([
                'title' => 'تعميد - ' . $data['code'],
                'reference_number' => $data['code'],
                'principal_amount' => $totalAmount,
                'expected_profit_amount' => $profit,
                'expected_rate' => $rate,
                'start_date' => $data['start_date'] ?? null,
                'maturity_date' => $data['maturity_date'] ?? null,
                'metadata' => json_encode($meta, JSON_UNESCAPED_UNICODE),
                'notes' => $data['notes'] ?? null,
                'updated_at' => now(),
            ]);

        if (array_key_exists('allocations', $data)) {
            DB::table('investment_opportunity_allocations')->where('opportunity_id', $id)->delete();

            foreach (($data['allocations'] ?? []) as $allocation) {
                $investorId = $this->investorId($allocation['investor']);
                $amount = round((float) $allocation['amount'], 2);
                if ($amount <= 0) {
                    continue;
                }

                $allocationProfit = $totalAmount > 0 ? round($profit * ($amount / $totalAmount), 2) : 0;

                DB::table('investment_opportunity_allocations')->insert([
                    'opportunity_id' => $id,
                    'investor_id' => $investorId,
                    'invested_amount' => $amount,
                    'expected_profit_amount' => $allocationProfit,
                    'actual_profit_amount' => 0,
                    'received_amount' => 0,
                    'status' => $investment->status,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        return response()->json(['data' => $this->readInvestment($id)]);
    }

    public function receive(int $id)
    {
        $platform = $this->platform();
        if (! $platform) {
            return response()->json(['message' => 'Ta3meed platform not found'], 404);
        }

        $investment = DB::table('investment_opportunities')
            ->where('id', $id)
            ->where('platform_id', $platform->id)
            ->first();

        if (! $investment) {
            return response()->json(['message' => 'Investment not found'], 404);
        }

        DB::table('investment_opportunities')
            ->where('id', $id)
            ->update([
                'status' => 'received',
                'actual_profit_amount' => $investment->expected_profit_amount,
                'completed_at' => now()->toDateString(),
                'updated_at' => now(),
            ]);

        $allocations = DB::table('investment_opportunity_allocations')
            ->where('opportunity_id', $id)
            ->get();

        foreach ($allocations as $allocation) {
            DB::table('investment_opportunity_allocations')
                ->where('id', $allocation->id)
                ->update([
                    'actual_profit_amount' => $allocation->expected_profit_amount,
                    'received_amount' => ((float) $allocation->invested_amount) + ((float) $allocation->expected_profit_amount),
                    'status' => 'received',
                    'updated_at' => now(),
                ]);
        }

        return response()->json(['data' => $this->readInvestment($id)]);
    }

    public function investorAccount(string $code)
    {
        $investor = $this->investorByCode($code);
        if (! $investor) {
            return response()->json(['message' => 'Investor not found'], 404);
        }

        return response()->json(['data' => $this->readInvestorAccount($investor)]);
    }

    public function storeInvestorAccountEntry(Request $request, string $code)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'entry_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $investor = $this->investorByCode($code);
        if (! $investor) {
            return response()->json(['message' => 'Investor not found'], 404);
        }

        DB::table('ta3meed_investor_account_entries')->insert([
            'investor_id' => $investor->id,
            'amount' => round((float) $data['amount'], 2),
            'entry_date' => $data['entry_date'] ?? now()->toDateString(),
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => $this->readInvestorAccount($investor)], 201);
    }

    private function platform()
    {
        return DB::table('investment_platforms')->where('code', 'ta3meed')->first();
    }

    private function meta(array $data, ?string $old): array
    {
        $meta = [];
        if ($old) {
            $decoded = json_decode($old, true);
            if (is_array($decoded)) {
                $meta = $decoded;
            }
        }

        $meta['category'] = $data['category'] ?? ($meta['category'] ?? null);
        $meta['months'] = $data['months'] ?? ($meta['months'] ?? null);
        $meta['withdrawal_date'] = $data['start_date'] ?? ($meta['withdrawal_date'] ?? null);
        $meta['returned_amount'] = $data['returned_amount'] ?? ($meta['returned_amount'] ?? null);

        return $meta;
    }

    private function investorId(string $name): int
    {
        $codes = [
            'أحمد' => 'ahmed',
            'سارة' => 'sara',
            'أمل' => 'amal',
            'امال' => 'amal',
            'أمي' => 'mother',
            'امي' => 'mother',
            'الوالد' => 'father',
        ];

        $code = $codes[$name] ?? strtolower(trim(str_replace(' ', '_', $name)));
        $id = DB::table('investment_investors')->where('code', $code)->value('id');

        if ($id) {
            return (int) $id;
        }

        return DB::table('investment_investors')->insertGetId([
            'code' => $code,
            'name' => $name,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function investorByCode(string $code)
    {
        return DB::table('investment_investors')
            ->where('code', $code)
            ->orWhere('name', $code)
            ->first();
    }

    private function readInvestorAccount($investor): array
    {
        $entries = DB::table('ta3meed_investor_account_entries')
            ->where('investor_id', $investor->id)
            ->orderByDesc('entry_date')
            ->orderByDesc('id')
            ->get();

        return [
            'investor' => $investor,
            'balance' => round((float) $entries->sum('amount'), 2),
            'entries' => $entries,
        ];
    }

    private function readInvestment(int $id)
    {
        $item = DB::table('investment_opportunities')->where('id', $id)->first();

        if ($item) {
            $item->allocations = DB::table('investment_opportunity_allocations')
                ->join('investment_investors', 'investment_opportunity_allocations.investor_id', '=', 'investment_investors.id')
                ->where('investment_opportunity_allocations.opportunity_id', $id)
                ->select([
                    'investment_opportunity_allocations.id',
                    'investment_investors.name as investor_name',
                    'investment_investors.code as investor_code',
                    'investment_opportunity_allocations.invested_amount',
                    'investment_opportunity_allocations.expected_profit_amount',
                    'investment_opportunity_allocations.received_amount',
                    'investment_opportunity_allocations.status',
                ])
                ->get();
        }

        return $item;
    }
}
