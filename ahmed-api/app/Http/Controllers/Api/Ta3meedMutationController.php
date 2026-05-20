<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Ta3meedInvestorName;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Ta3meedMutationController extends Controller
{
    public function update(Request $request, int $id)
    {
        $userId = $this->userId($request);
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
        if (! $platform) return response()->json(['message' => 'Ta3meed platform not found'], 404);

        $investmentQuery = DB::table('investment_opportunities')->where('id', $id)->where('platform_id', $platform->id);
        $this->scopeUser($investmentQuery, 'investment_opportunities', $userId);
        $investment = $investmentQuery->first();
        if (! $investment) return response()->json(['message' => 'Investment not found'], 404);

        $totalAmount = round((float) $data['total_amount'], 2);
        $profit = round((float) ($data['profit'] ?? 0), 2);
        $rate = $data['profit_rate'] ?? ($totalAmount > 0 ? round(($profit / $totalAmount) * 100, 4) : null);
        $meta = $this->meta($data, $investment->metadata);

        DB::table('investment_opportunities')->where('id', $id)->update([
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
            $deleteQuery = DB::table('investment_opportunity_allocations')->where('opportunity_id', $id);
            $this->scopeUser($deleteQuery, 'investment_opportunity_allocations', $userId);
            $deleteQuery->delete();

            foreach (($data['allocations'] ?? []) as $allocation) {
                $investorId = $this->investorId($allocation['investor'], $userId);
                $amount = round((float) $allocation['amount'], 2);
                if ($amount <= 0) continue;
                $allocationProfit = $totalAmount > 0 ? round($profit * ($amount / $totalAmount), 2) : 0;
                $insert = [
                    'opportunity_id' => $id,
                    'investor_id' => $investorId,
                    'invested_amount' => $amount,
                    'expected_profit_amount' => $allocationProfit,
                    'actual_profit_amount' => 0,
                    'received_amount' => 0,
                    'status' => $investment->status,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                $this->attachUser($insert, 'investment_opportunity_allocations', $userId);
                DB::table('investment_opportunity_allocations')->insert($insert);
            }
        }

        return response()->json(['data' => $this->readInvestment($id, $userId)]);
    }

    public function receive(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $platform = $this->platform();
        if (! $platform) return response()->json(['message' => 'Ta3meed platform not found'], 404);

        $investmentQuery = DB::table('investment_opportunities')->where('id', $id)->where('platform_id', $platform->id);
        $this->scopeUser($investmentQuery, 'investment_opportunities', $userId);
        $investment = $investmentQuery->first();
        if (! $investment) return response()->json(['message' => 'Investment not found'], 404);

        $receivedDate = now()->toDateString();
        $update = ['status' => 'received', 'actual_profit_amount' => $investment->expected_profit_amount, 'updated_at' => now()];
        if (Schema::hasColumn('investment_opportunities', 'completed_at')) $update['completed_at'] = $receivedDate;
        if (Schema::hasColumn('investment_opportunities', 'received_at')) $update['received_at'] = $receivedDate;
        DB::table('investment_opportunities')->where('id', $id)->update($update);

        $allocationsQuery = DB::table('investment_opportunity_allocations')->where('opportunity_id', $id);
        $this->scopeUser($allocationsQuery, 'investment_opportunity_allocations', $userId);
        foreach ($allocationsQuery->get() as $allocation) {
            DB::table('investment_opportunity_allocations')->where('id', $allocation->id)->update([
                'actual_profit_amount' => $allocation->expected_profit_amount,
                'received_amount' => ((float) $allocation->invested_amount) + ((float) $allocation->expected_profit_amount),
                'status' => 'received',
                'updated_at' => now(),
            ]);
        }

        return response()->json(['data' => $this->readInvestment($id, $userId)]);
    }

    public function investorAccount(Request $request, string $code)
    {
        $userId = $this->userId($request);
        $investor = $this->investorByCode($code, $userId);
        if (! $investor) return response()->json(['message' => 'Investor not found'], 404);
        return response()->json(['data' => $this->readInvestorAccount($investor, $userId)]);
    }

    public function storeInvestorAccountEntry(Request $request, string $code)
    {
        $userId = $this->userId($request);
        $investor = $this->investorByCode($code, $userId);
        if (! $investor) return response()->json(['message' => 'Investor not found'], 404);
        $amount = $this->signedEntryAmount($request);
        $insert = [
            'investor_id' => $investor->id,
            'amount' => $amount,
            'entry_date' => $request->input('entry_date') ?: now()->toDateString(),
            'notes' => $request->input('notes'),
            'created_at' => now(),
            'updated_at' => now(),
        ];
        $this->attachUser($insert, 'ta3meed_investor_account_entries', $userId);
        DB::table('ta3meed_investor_account_entries')->insert($insert);
        return response()->json(['data' => $this->readInvestorAccount($investor, $userId)], 201);
    }

    public function updateInvestorAccountEntry(Request $request, string $code, int $entryId)
    {
        $userId = $this->userId($request);
        $investor = $this->investorByCode($code, $userId);
        if (! $investor) return response()->json(['message' => 'Investor not found'], 404);
        $entryQuery = DB::table('ta3meed_investor_account_entries')->where('id', $entryId)->where('investor_id', $investor->id);
        $this->scopeUser($entryQuery, 'ta3meed_investor_account_entries', $userId);
        if (! $entryQuery->first()) return response()->json(['message' => 'Entry not found'], 404);
        DB::table('ta3meed_investor_account_entries')->where('id', $entryId)->update([
            'amount' => $this->signedEntryAmount($request),
            'entry_date' => $request->input('entry_date') ?: now()->toDateString(),
            'notes' => $request->input('notes'),
            'updated_at' => now(),
        ]);
        return response()->json(['data' => $this->readInvestorAccount($investor, $userId)]);
    }

    public function deleteInvestorAccountEntry(Request $request, string $code, int $entryId)
    {
        $userId = $this->userId($request);
        $investor = $this->investorByCode($code, $userId);
        if (! $investor) return response()->json(['message' => 'Investor not found'], 404);
        $deleteQuery = DB::table('ta3meed_investor_account_entries')->where('id', $entryId)->where('investor_id', $investor->id);
        $this->scopeUser($deleteQuery, 'ta3meed_investor_account_entries', $userId);
        $deleted = $deleteQuery->delete();
        if (! $deleted) return response()->json(['message' => 'Entry not found'], 404);
        return response()->json(['data' => $this->readInvestorAccount($investor, $userId)]);
    }

    private function signedEntryAmount(Request $request): float
    {
        $data = $request->validate(['amount' => ['required', 'numeric', 'min:0.01'], 'type' => ['nullable', 'in:deposit,withdrawal'], 'entry_date' => ['nullable', 'date'], 'notes' => ['nullable', 'string']]);
        $amount = round((float) $data['amount'], 2);
        return (($data['type'] ?? 'deposit') === 'withdrawal') ? $amount * -1 : $amount;
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
            if (is_array($decoded)) $meta = $decoded;
        }
        $meta['category'] = $data['category'] ?? ($meta['category'] ?? null);
        $meta['months'] = $data['months'] ?? ($meta['months'] ?? null);
        $meta['withdrawal_date'] = $data['start_date'] ?? ($meta['withdrawal_date'] ?? null);
        $meta['returned_amount'] = $data['returned_amount'] ?? ($meta['returned_amount'] ?? null);
        return $meta;
    }

    private function investorId(string $name, int $userId): int
    {
        $code = Ta3meedInvestorName::code($name);
        $displayName = Ta3meedInvestorName::displayName($name, $code);
        $query = DB::table('investment_investors')->where(function ($q) use ($code, $name) {
            $q->where('code', $code)->orWhere('name', $name);
        });
        $this->scopeUser($query, 'investment_investors', $userId);
        $existing = $query->first();
        if ($existing) {
            $update = ['code' => $code, 'name' => $displayName, 'is_active' => true];
            if (Schema::hasColumn('investment_investors', 'updated_at')) $update['updated_at'] = now();
            DB::table('investment_investors')->where('id', $existing->id)->update($update);
            return (int) $existing->id;
        }
        $insert = ['code' => $code, 'name' => $displayName, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()];
        $this->attachUser($insert, 'investment_investors', $userId);
        return DB::table('investment_investors')->insertGetId($insert);
    }

    private function investorByCode(string $code, int $userId)
    {
        $canonicalCode = Ta3meedInvestorName::code($code);
        $query = DB::table('investment_investors')->where(function ($q) use ($code, $canonicalCode) {
            $q->where('code', $canonicalCode)->orWhere('code', $code)->orWhere('name', $code);
        });
        $this->scopeUser($query, 'investment_investors', $userId);
        $investor = $query->first();

        if ($investor) {
            $displayName = Ta3meedInvestorName::displayName($investor->name, $canonicalCode);
            if ($investor->code !== $canonicalCode || $investor->name !== $displayName) {
                $update = ['code' => $canonicalCode, 'name' => $displayName];
                if (Schema::hasColumn('investment_investors', 'updated_at')) $update['updated_at'] = now();
                DB::table('investment_investors')->where('id', $investor->id)->update($update);
                $investor->code = $canonicalCode;
                $investor->name = $displayName;
            }
        }

        return $investor;
    }

    private function readInvestorAccount($investor, int $userId): array
    {
        $query = DB::table('ta3meed_investor_account_entries')->where('investor_id', $investor->id);
        $this->scopeUser($query, 'ta3meed_investor_account_entries', $userId);
        $entries = $query->orderByDesc('entry_date')->orderByDesc('id')->get();
        return ['investor' => $investor, 'balance' => round((float) $entries->sum('amount'), 2), 'entries' => $entries];
    }

    private function readInvestment(int $id, int $userId)
    {
        $query = DB::table('investment_opportunities')->where('id', $id);
        $this->scopeUser($query, 'investment_opportunities', $userId);
        $item = $query->first();
        if ($item) {
            $allocationQuery = DB::table('investment_opportunity_allocations')
                ->join('investment_investors', 'investment_opportunity_allocations.investor_id', '=', 'investment_investors.id')
                ->where('investment_opportunity_allocations.opportunity_id', $id);
            $this->scopeUser($allocationQuery, 'investment_opportunity_allocations', $userId);
            $item->allocations = $allocationQuery->select([
                'investment_opportunity_allocations.id',
                'investment_investors.name as investor_name',
                'investment_investors.code as investor_code',
                'investment_opportunity_allocations.invested_amount',
                'investment_opportunity_allocations.expected_profit_amount',
                'investment_opportunity_allocations.received_amount',
                'investment_opportunity_allocations.status',
            ])->get();
        }
        return $item;
    }

    private function userId(Request $request): int
    {
        $id = (int) $request->header('X-Ahmed-User-Id', 0);
        if ($id > 0 && Schema::hasTable('users') && DB::table('users')->where('id', $id)->exists()) return $id;
        return Schema::hasTable('users') ? (int) (DB::table('users')->orderBy('id')->value('id') ?: 1) : 1;
    }

    private function scopeUser($query, string $table, int $userId): void
    {
        if (Schema::hasColumn($table, 'user_id')) $query->where($table . '.user_id', $userId);
    }

    private function attachUser(array &$data, string $table, int $userId): void
    {
        if (Schema::hasColumn($table, 'user_id')) $data['user_id'] = $userId;
    }
}
