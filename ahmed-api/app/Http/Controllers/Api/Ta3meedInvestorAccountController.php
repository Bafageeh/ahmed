<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Ta3meedInvestorAccountController extends Controller
{
    public function show(string $code)
    {
        $investor = DB::table('investment_investors')
            ->where('code', $code)
            ->orWhere('name', $code)
            ->first();

        if (! $investor) {
            return response()->json(['message' => 'Investor not found'], 404);
        }

        $platform = DB::table('investment_platforms')->where('code', 'ta3meed')->first();
        if (! $platform) {
            return response()->json(['message' => 'Ta3meed platform not found'], 404);
        }

        $opportunities = DB::table('investment_opportunity_allocations')
            ->join('investment_opportunities', 'investment_opportunity_allocations.opportunity_id', '=', 'investment_opportunities.id')
            ->where('investment_opportunities.platform_id', $platform->id)
            ->where('investment_opportunity_allocations.investor_id', $investor->id)
            ->select([
                'investment_opportunities.id as opportunity_id',
                'investment_opportunities.reference_number',
                'investment_opportunities.status as opportunity_status',
                'investment_opportunities.principal_amount',
                'investment_opportunities.expected_profit_amount as opportunity_expected_profit',
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
                $row->expected_total = round((float) $row->invested_amount + (float) $row->expected_profit_amount, 2);
                $row->remaining_amount = max(0, round($row->expected_total - (float) $row->received_amount, 2));
                $row->share_percent = ((float) $row->principal_amount) > 0
                    ? round(((float) $row->invested_amount / (float) $row->principal_amount) * 100, 6)
                    : 0;
                return $row;
            });

        $receiptEntries = collect();
        if (Schema::hasTable('ta3meed_receipt_allocations') && Schema::hasTable('ta3meed_receipts')) {
            $receiptEntries = DB::table('ta3meed_receipt_allocations')
                ->join('ta3meed_receipts', 'ta3meed_receipt_allocations.receipt_id', '=', 'ta3meed_receipts.id')
                ->join('investment_opportunities', 'ta3meed_receipt_allocations.opportunity_id', '=', 'investment_opportunities.id')
                ->where('ta3meed_receipt_allocations.investor_id', $investor->id)
                ->where('investment_opportunities.platform_id', $platform->id)
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
            $manualEntries = DB::table('ta3meed_investor_account_entries')
                ->where('investor_id', $investor->id)
                ->orderByDesc('entry_date')
                ->orderByDesc('id')
                ->get();
        }

        $summary = [
            'invested' => round((float) $opportunities->sum('invested_amount'), 2),
            'expected_profit' => round((float) $opportunities->sum('expected_profit_amount'), 2),
            'expected_total' => round((float) $opportunities->sum('expected_total'), 2),
            'received' => round((float) $opportunities->sum('received_amount'), 2),
            'actual_profit' => round((float) $opportunities->sum('actual_profit_amount'), 2),
            'remaining' => round((float) $opportunities->sum('remaining_amount'), 2),
            'manual_balance' => round((float) $manualEntries->sum('amount'), 2),
            'opportunities_count' => $opportunities->count(),
            'receipts_count' => $receiptEntries->count(),
        ];

        return response()->json([
            'data' => [
                'investor' => $investor,
                'summary' => $summary,
                'opportunities' => $opportunities,
                'receipt_entries' => $receiptEntries,
                'manual_entries' => $manualEntries,
            ],
        ]);
    }
}
