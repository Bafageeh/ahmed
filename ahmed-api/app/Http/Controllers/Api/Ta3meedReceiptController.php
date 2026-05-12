<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Ta3meedReceiptController extends Controller
{
    public function parse(Request $request)
    {
        $data = $request->validate(['message' => ['required', 'string']]);
        return response()->json(['data' => $this->parseMessage($data['message'])]);
    }

    public function applyMessage(Request $request)
    {
        $data = $request->validate([
            'message' => ['required', 'string'],
            'receipt_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $parsed = $this->parseMessage($data['message']);
        if (! $parsed['amount'] || ! $parsed['reference_number']) {
            return response()->json(['message' => 'تعذر قراءة مبلغ السداد أو رقم الفرصة من الرسالة', 'data' => $parsed], 422);
        }

        $platform = DB::table('investment_platforms')->where('code', 'ta3meed')->first();
        if (! $platform) return response()->json(['message' => 'Ta3meed platform not found'], 404);

        $investment = DB::table('investment_opportunities')
            ->where('platform_id', $platform->id)
            ->where('reference_number', $parsed['reference_number'])
            ->first();

        if (! $investment) {
            return response()->json(['message' => 'لم يتم العثور على فرصة تعميد بهذا الرقم', 'data' => $parsed], 404);
        }

        $receipt = $this->record($investment, [
            'amount' => $parsed['amount'],
            'receipt_type' => $parsed['receipt_type'],
            'receipt_date' => $data['receipt_date'] ?? now()->toDateString(),
            'reference_number' => $parsed['reference_number'],
            'source_message' => $data['message'],
            'notes' => $data['notes'] ?? $parsed['label'],
            'force_complete' => $parsed['is_final'],
        ]);

        return response()->json(['data' => ['parsed' => $parsed, 'receipt' => $receipt, 'investment' => $this->readInvestment($investment->id)]]);
    }

    public function store(Request $request, int $id)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'receipt_type' => ['nullable', 'in:partial,full,early_settlement'],
            'receipt_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'source_message' => ['nullable', 'string'],
            'force_complete' => ['nullable', 'boolean'],
        ]);

        $platform = DB::table('investment_platforms')->where('code', 'ta3meed')->first();
        if (! $platform) return response()->json(['message' => 'Ta3meed platform not found'], 404);

        $investment = DB::table('investment_opportunities')
            ->where('id', $id)
            ->where('platform_id', $platform->id)
            ->first();

        if (! $investment) return response()->json(['message' => 'Investment not found'], 404);

        $receipt = $this->record($investment, [
            'amount' => round((float) $data['amount'], 2),
            'receipt_type' => $data['receipt_type'] ?? 'partial',
            'receipt_date' => $data['receipt_date'] ?? now()->toDateString(),
            'reference_number' => $investment->reference_number,
            'source_message' => $data['source_message'] ?? null,
            'notes' => $data['notes'] ?? null,
            'force_complete' => (bool) ($data['force_complete'] ?? false),
        ]);

        return response()->json(['data' => ['receipt' => $receipt, 'investment' => $this->readInvestment($id)]]);
    }

    private function parseMessage(string $message): array
    {
        $normalized = trim(str_replace(["\u{200f}", "\u{200e}", ','], ['', '', ''], $message));
        preg_match('/(?:بقيمة|مبلغ)\s*([0-9]+(?:\.[0-9]+)?)/u', $normalized, $amountMatch);

        $reference = null;
        $patterns = [
            '/(?:للفرصه|للفرصة|الفرصه|الفرصة)\s*(?:رقم)?\s*([A-Z]{2,}-[A-Z0-9]+|[A-Z]{3,}[0-9]+)/u',
            '/(?:رقم)\s*([A-Z]{2,}-[A-Z0-9]+|[A-Z]{3,}[0-9]+)/u',
            '/\b([A-Z]{2,}-[A-Z0-9]+|[A-Z]{3,}[0-9]{2,})\b/u',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $normalized, $match)) {
                $reference = $match[1];
                break;
            }
        }

        $hasCapitalAndProfit = str_contains($normalized, 'رأس المال') || str_contains($normalized, 'راس المال') || str_contains($normalized, 'الأرباح') || str_contains($normalized, 'الارباح');
        $hasFull = str_contains($normalized, 'سداد كلي') || $hasCapitalAndProfit;
        $hasPartial = str_contains($normalized, 'سداد جزئي');

        return [
            'amount' => isset($amountMatch[1]) ? round((float) $amountMatch[1], 2) : null,
            'reference_number' => $reference,
            'receipt_type' => $hasFull ? 'full' : 'partial',
            'is_final' => $hasFull,
            'is_partial' => $hasPartial && ! $hasFull,
            'label' => $hasFull ? 'رأس المال والأرباح / سداد كلي' : 'سداد جزئي',
            'raw' => $message,
        ];
    }

    private function record($investment, array $data): array
    {
        return DB::transaction(function () use ($investment, $data) {
            $amount = round((float) $data['amount'], 2);
            $receiptType = $data['receipt_type'] ?? 'partial';
            $receiptDate = $data['receipt_date'] ?? now()->toDateString();
            $reference = $data['reference_number'] ?? $investment->reference_number;
            $sourceMessage = $data['source_message'] ?? null;

            $duplicateQuery = DB::table('ta3meed_receipts')
                ->where('opportunity_id', $investment->id)
                ->where('reference_number', $reference)
                ->where('amount', $amount)
                ->where('receipt_type', $receiptType);

            if ($sourceMessage) {
                $duplicateQuery->where('source_message', $sourceMessage);
            } else {
                $duplicateQuery->where('receipt_date', $receiptDate);
            }

            $duplicate = $duplicateQuery->orderByDesc('id')->first();
            if ($duplicate) {
                $this->recalculate($investment->id, (bool) ($data['force_complete'] ?? false));
                return [
                    'id' => $duplicate->id,
                    'amount' => round((float) $duplicate->amount, 2),
                    'receipt_type' => $duplicate->receipt_type,
                    'receipt_date' => $duplicate->receipt_date,
                    'reference_number' => $duplicate->reference_number,
                    'duplicate' => true,
                ];
            }

            $receiptId = DB::table('ta3meed_receipts')->insertGetId([
                'opportunity_id' => $investment->id,
                'amount' => $amount,
                'receipt_type' => $receiptType,
                'receipt_date' => $receiptDate,
                'reference_number' => $reference,
                'source_message' => $sourceMessage,
                'notes' => $data['notes'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $allocations = DB::table('investment_opportunity_allocations')->where('opportunity_id', $investment->id)->get();
            $totalAllocated = round((float) $allocations->sum('invested_amount'), 2);
            $distributed = 0.0;
            $count = $allocations->count();

            foreach ($allocations as $index => $allocation) {
                $share = $totalAllocated > 0 ? ((float) $allocation->invested_amount / $totalAllocated) : ($count > 0 ? 1 / $count : 0);
                $allocatedAmount = ($index === $count - 1) ? round($amount - $distributed, 2) : round($amount * $share, 2);
                $distributed += $allocatedAmount;

                DB::table('ta3meed_receipt_allocations')->insert([
                    'receipt_id' => $receiptId,
                    'opportunity_id' => $investment->id,
                    'allocation_id' => $allocation->id,
                    'investor_id' => $allocation->investor_id,
                    'share_percent' => round($share * 100, 6),
                    'received_amount' => $allocatedAmount,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $this->recalculate($investment->id, (bool) ($data['force_complete'] ?? false));

            return [
                'id' => $receiptId,
                'amount' => $amount,
                'receipt_type' => $receiptType,
                'receipt_date' => $receiptDate,
                'reference_number' => $reference,
                'duplicate' => false,
            ];
        });
    }

    private function recalculate(int $opportunityId, bool $forceComplete = false): void
    {
        $investment = DB::table('investment_opportunities')->where('id', $opportunityId)->first();
        if (! $investment) return;

        $totalReceived = round((float) DB::table('ta3meed_receipts')->where('opportunity_id', $opportunityId)->sum('amount'), 2);
        $expectedTotal = round((float) $investment->principal_amount + (float) $investment->expected_profit_amount, 2);
        $isComplete = $forceComplete || ($expectedTotal > 0 && $totalReceived >= $expectedTotal - 0.01);
        $status = $isComplete ? 'received' : ($totalReceived > 0 ? 'partial_received' : 'active');
        $actualProfit = $isComplete ? round($totalReceived - (float) $investment->principal_amount, 2) : 0;
        $settlementDiff = $isComplete ? round($totalReceived - $expectedTotal, 2) : 0;
        $remaining = $isComplete ? 0 : max(0, round($expectedTotal - $totalReceived, 2));

        $meta = json_decode($investment->metadata ?: '{}', true) ?: [];
        $meta['ta3meed_received_total'] = $totalReceived;
        $meta['ta3meed_remaining_amount'] = $remaining;
        $meta['ta3meed_expected_total'] = $expectedTotal;
        $meta['ta3meed_settlement_difference'] = $settlementDiff;
        $meta['ta3meed_settlement_note'] = $settlementDiff < 0 ? 'تسوية مبكرة أقل من المتوقع' : ($settlementDiff > 0 ? 'تسوية أعلى من المتوقع' : null);

        $update = [
            'status' => $status,
            'actual_profit_amount' => $actualProfit,
            'metadata' => json_encode($meta, JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ];
        if ($isComplete && Schema::hasColumn('investment_opportunities', 'completed_at')) $update['completed_at'] = now()->toDateString();
        if ($isComplete && Schema::hasColumn('investment_opportunities', 'received_at')) $update['received_at'] = now()->toDateString();
        DB::table('investment_opportunities')->where('id', $opportunityId)->update($update);

        $allocations = DB::table('investment_opportunity_allocations')->where('opportunity_id', $opportunityId)->get();
        foreach ($allocations as $allocation) {
            $received = round((float) DB::table('ta3meed_receipt_allocations')->where('allocation_id', $allocation->id)->sum('received_amount'), 2);
            DB::table('investment_opportunity_allocations')->where('id', $allocation->id)->update([
                'received_amount' => $received,
                'actual_profit_amount' => $isComplete ? round($received - (float) $allocation->invested_amount, 2) : 0,
                'status' => $status,
                'updated_at' => now(),
            ]);
        }
    }

    private function readInvestment(int $id)
    {
        $item = DB::table('investment_opportunities')->where('id', $id)->first();
        if (! $item) return null;

        $item->allocations = DB::table('investment_opportunity_allocations')
            ->join('investment_investors', 'investment_opportunity_allocations.investor_id', '=', 'investment_investors.id')
            ->where('investment_opportunity_allocations.opportunity_id', $id)
            ->select([
                'investment_opportunity_allocations.id',
                'investment_investors.name as investor_name',
                'investment_investors.code as investor_code',
                'investment_opportunity_allocations.invested_amount',
                'investment_opportunity_allocations.expected_profit_amount',
                'investment_opportunity_allocations.actual_profit_amount',
                'investment_opportunity_allocations.received_amount',
                'investment_opportunity_allocations.status',
            ])->get();

        $item->receipts = DB::table('ta3meed_receipts')->where('opportunity_id', $id)->orderByDesc('receipt_date')->orderByDesc('id')->get();
        return $item;
    }
}
