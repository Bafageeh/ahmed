<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Ta3meedInvestorAccountController extends Controller
{
    public function show(Request $request, string $code)
    {
        $userId = $this->userId($request);
        $fromDate = $request->query('from_date');
        $toDate = $request->query('to_date');

        $investorQuery = DB::table('investment_investors')
            ->where(function ($query) use ($code) {
                $query->where('code', $code)->orWhere('name', $code);
            });
        $this->scopeUser($investorQuery, 'investment_investors', $userId);
        $investor = $investorQuery->first();

        if (! $investor) {
            return response()->json(['message' => 'Investor not found'], 404);
        }

        $platform = DB::table('investment_platforms')->where('code', 'ta3meed')->first();
        if (! $platform) {
            return response()->json(['message' => 'Ta3meed platform not found'], 404);
        }

        $opportunityQuery = DB::table('investment_opportunity_allocations')
            ->join('investment_opportunities', 'investment_opportunity_allocations.opportunity_id', '=', 'investment_opportunities.id')
            ->where('investment_opportunities.platform_id', $platform->id)
            ->where('investment_opportunity_allocations.investor_id', $investor->id);
        $this->scopeUser($opportunityQuery, 'investment_opportunity_allocations', $userId);

        $opportunities = $opportunityQuery
            ->select([
                'investment_opportunities.id as opportunity_id',
                'investment_opportunities.reference_number',
                'investment_opportunities.status as opportunity_status',
                'investment_opportunities.principal_amount',
                'investment_opportunities.expected_profit_amount as opportunity_expected_profit',
                'investment_opportunities.expected_rate',
                'investment_opportunities.maturity_date',
                'investment_opportunities.metadata',
                'investment_opportunity_allocations.id as allocation_id',
                'investment_opportunity_allocations.invested_amount',
                'investment_opportunity_allocations.expected_profit_amount',
                'investment_opportunity_allocations.actual_profit_amount',
                'investment_opportunity_allocations.received_amount',
                'investment_opportunity_allocations.status as allocation_status',
            ])
            ->orderByDesc('investment_opportunities.maturity_date')
            ->orderByDesc('investment_opportunities.id')
            ->get()
            ->map(function ($row) {
                $investedAmount = (float) $row->invested_amount;
                $receivedAmount = (float) $row->received_amount;
                $expectedProfitAmount = (float) $row->expected_profit_amount;
                $expectedTotal = $investedAmount + $expectedProfitAmount;

                $row->expected_total = round($expectedTotal, 2);
                $row->remaining_amount = max(0, round($row->expected_total - $receivedAmount, 2));
                $row->share_percent = ((float) $row->principal_amount) > 0
                    ? round(($investedAmount / (float) $row->principal_amount) * 100, 6)
                    : 0;

                $actualProfit = max(0, $receivedAmount - $investedAmount);
                $row->actual_profit_amount = round($actualProfit, 2);
                $row->contribution_profit_amount = round($actualProfit, 2);
                $row->ended_profit_amount = round($actualProfit, 2);

                $registeredRate = (float) $row->expected_rate;
                if ($registeredRate <= 0 && $investedAmount > 0 && $expectedProfitAmount > 0) {
                    $registeredRate = ($expectedProfitAmount / $investedAmount) * 100;
                }
                $row->registered_profit_rate = round($registeredRate, 6);

                $status = strtolower(trim((string) ($row->opportunity_status ?: $row->allocation_status)));
                $closedStatuses = ['received', 'completed', 'closed', 'finished', 'ended'];
                $isEnded = in_array($status, $closedStatuses, true) || ((float) $row->remaining_amount) <= 0;
                $shouldShowActualRate = $isEnded
                    && $investedAmount > 0
                    && $actualProfit > 0;

                $row->actual_received_profit_amount = $shouldShowActualRate ? round($actualProfit, 2) : null;
                $row->actual_received_profit_rate = $shouldShowActualRate ? round(($actualProfit / $investedAmount) * 100, 6) : null;
                $row->show_actual_received_profit_rate = $shouldShowActualRate;

                return $row;
            });

        $receiptEntries = collect();
        if (Schema::hasTable('ta3meed_receipt_allocations') && Schema::hasTable('ta3meed_receipts')) {
            $receiptQuery = DB::table('ta3meed_receipt_allocations')
                ->join('ta3meed_receipts', 'ta3meed_receipt_allocations.receipt_id', '=', 'ta3meed_receipts.id')
                ->join('investment_opportunities', 'ta3meed_receipt_allocations.opportunity_id', '=', 'investment_opportunities.id')
                ->where('ta3meed_receipt_allocations.investor_id', $investor->id)
                ->where('investment_opportunities.platform_id', $platform->id);
            $this->scopeUser($receiptQuery, 'ta3meed_receipt_allocations', $userId);

            if ($fromDate) {
                $receiptQuery->whereDate('ta3meed_receipts.receipt_date', '>=', $fromDate);
            }
            if ($toDate) {
                $receiptQuery->whereDate('ta3meed_receipts.receipt_date', '<=', $toDate);
            }

            $receiptEntries = $receiptQuery
                ->select([
                    'ta3meed_receipts.id as receipt_id',
                    'ta3meed_receipts.receipt_date',
                    'ta3meed_receipts.receipt_type',
                    'ta3meed_receipts.reference_number',
                    'ta3meed_receipts.amount as total_receipt_amount',
                    'ta3meed_receipt_allocations.received_amount',
                    'ta3meed_receipt_allocations.share_percent',
                    'investment_opportunities.id as opportunity_id',
                    'investment_opportunities.reference_number as opportunity_reference',
                ])
                ->orderByDesc('ta3meed_receipts.receipt_date')
                ->orderByDesc('ta3meed_receipts.id')
                ->get();
        }

        $manualEntries = collect();
        if (Schema::hasTable('ta3meed_investor_account_entries')) {
            $manualQuery = DB::table('ta3meed_investor_account_entries')
                ->where('investor_id', $investor->id);
            $this->scopeUser($manualQuery, 'ta3meed_investor_account_entries', $userId);

            if ($fromDate) {
                $manualQuery->whereDate('entry_date', '>=', $fromDate);
            }
            if ($toDate) {
                $manualQuery->whereDate('entry_date', '<=', $toDate);
            }

            $manualEntries = $manualQuery
                ->orderByDesc('entry_date')
                ->orderByDesc('id')
                ->get();
        }

        $timeline = $this->timeline($receiptEntries, $manualEntries);
        $endedProfit = $opportunities
            ->filter(fn ($row) => in_array(strtolower(trim((string) ($row->opportunity_status ?: $row->allocation_status))), ['received', 'completed', 'closed', 'finished', 'ended'], true) || ((float) $row->remaining_amount) <= 0)
            ->sum('ended_profit_amount');

        $summary = [
            'invested' => round((float) $opportunities->sum('invested_amount'), 2),
            'expected_profit' => round((float) $opportunities->sum('expected_profit_amount'), 2),
            'expected_total' => round((float) $opportunities->sum('expected_total'), 2),
            'received' => round((float) $opportunities->sum('received_amount'), 2),
            'actual_profit' => round((float) $opportunities->sum('actual_profit_amount'), 2),
            'ended_profit' => round((float) $endedProfit, 2),
            'remaining' => round((float) $opportunities->sum('remaining_amount'), 2),
            'period_received' => round((float) $receiptEntries->sum('received_amount'), 2),
            'manual_balance' => round((float) $manualEntries->sum('amount'), 2),
            'net_balance' => round((float) $receiptEntries->sum('received_amount') + (float) $manualEntries->sum('amount'), 2),
            'opportunities_count' => $opportunities->count(),
            'receipts_count' => $receiptEntries->count(),
            'manual_entries_count' => $manualEntries->count(),
            'timeline_count' => $timeline->count(),
        ];

        return response()->json([
            'data' => [
                'investor' => $investor,
                'filters' => [
                    'from_date' => $fromDate,
                    'to_date' => $ToDate ?? $toDate,
                ],
                'summary' => $summary,
                'opportunities' => $opportunities,
                'receipt_entries' => $receiptEntries,
                'manual_entries' => $manualEntries,
                'timeline' => $timeline,
            ],
        ]);
    }

    private function timeline($receiptEntries, $manualEntries)
    {
        $receiptTimeline = $receiptEntries->map(function ($entry) {
            return [
                'id' => 'receipt-' . $entry->receipt_id,
                'type' => 'receipt',
                'label' => $entry->receipt_type === 'full' ? 'سداد كلي' : 'سداد جزئي',
                'date' => $entry->receipt_date,
                'amount' => round((float) $entry->received_amount, 2),
                'direction' => 'in',
                'reference_number' => $entry->opportunity_reference ?: $entry->reference_number,
                'description' => 'استلام من فرصة ' . ($entry->opportunity_reference ?: $entry->reference_number),
                'payload' => $entry,
            ];
        });

        $manualTimeline = $manualEntries->map(function ($entry) {
            $amount = round((float) $entry->amount, 2);
            return [
                'id' => 'manual-' . $entry->id,
                'type' => 'manual',
                'label' => $amount >= 0 ? 'إيداع يدوي' : 'سحب يدوي',
                'date' => $entry->entry_date,
                'amount' => $amount,
                'direction' => $amount >= 0 ? 'in' : 'out',
                'reference_number' => null,
                'description' => $entry->notes ?: ($amount >= 0 ? 'إيداع يدوي' : 'سحب يدوي'),
                'payload' => $entry,
            ];
        });

        return $receiptTimeline
            ->merge($manualTimeline)
            ->sortByDesc(function ($entry) {
                return ($entry['date'] ?: '0000-00-00') . '-' . $entry['id'];
            })
            ->values();
    }

    private function userId(Request $request): int
    {
        $id = (int) $request->header('X-Ahmed-User-Id', 0);
        if ($id > 0 && Schema::hasTable('users') && DB::table('users')->where('id', $id)->exists()) {
            return $id;
        }

        return Schema::hasTable('users') ? (int) (DB::table('users')->orderBy('id')->value('id') ?: 1) : 1;
    }

    private function scopeUser($query, string $table, int $userId): void
    {
        if (Schema::hasColumn($table, 'user_id')) {
            $query->where($table . '.user_id', $userId);
        }
    }
}
