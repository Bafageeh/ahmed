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
        return $this->applyMessageInternal($request, false);
    }

    public function applyMessageConfirmed(Request $request)
    {
        return $this->applyMessageInternal($request, true);
    }

    private function applyMessageInternal(Request $request, bool $allowDuplicate)
    {
        $userId = $this->userId($request);
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

        $investment = $this->findInvestmentByReference((int) $platform->id, $parsed['reference_number'], $userId);

        if (! $investment) {
            return response()->json(['message' => 'لم يتم العثور على فرصة تعميد بهذا الرقم', 'data' => $parsed], 404);
        }

        $parsed['reference_number'] = $investment->reference_number;

        if ($this->hasFullReceipt((int) $investment->id, $userId)) {
            return response()->json([
                'message' => 'تم رفض إضافة السداد: يوجد سداد كلي مسجل سابقًا لنفس رقم الفرصة.',
                'data' => [
                    'blocked' => true,
                    'reason' => 'full_receipt_exists',
                    'parsed' => $parsed,
                    'investment' => $this->readInvestment((int) $investment->id, $userId),
                ],
            ], 409);
        }

        $receipt = $this->record($investment, [
            'amount' => $parsed['amount'],
            'receipt_type' => $parsed['receipt_type'],
            'receipt_date' => $data['receipt_date'] ?? now()->toDateString(),
            'reference_number' => $investment->reference_number,
            'source_message' => $data['message'],
            'notes' => $data['notes'] ?? $parsed['label'],
            'force_complete' => $parsed['is_final'],
            'allow_duplicate' => $allowDuplicate,
        ]);

        if (($receipt['duplicate'] ?? false) && ! $allowDuplicate) {
            return response()->json([
                'message' => 'هذه الدفعة مسجلة سابقًا، هل تريد إضافتها مرة أخرى؟',
                'data' => [
                    'duplicate' => true,
                    'needs_confirmation' => true,
                    'parsed' => $parsed,
                    'receipt' => $receipt,
                    'investment' => $this->readInvestment($investment->id, $userId),
                ],
            ], 409);
        }

        return response()->json(['data' => ['parsed' => $parsed, 'receipt' => $receipt, 'investment' => $this->readInvestment($investment->id, $userId)]]);
    }

    public function store(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'receipt_type' => ['nullable', 'in:partial,full,early_settlement'],
            'receipt_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'source_message' => ['nullable', 'string'],
            'force_complete' => ['nullable', 'boolean'],
            'allow_duplicate' => ['nullable', 'boolean'],
        ]);

        $platform = DB::table('investment_platforms')->where('code', 'ta3meed')->first();
        if (! $platform) return response()->json(['message' => 'Ta3meed platform not found'], 404);

        $investmentQuery = DB::table('investment_opportunities')
            ->where('id', $id)
            ->where('platform_id', $platform->id);
        $this->scopeUser($investmentQuery, 'investment_opportunities', $userId);
        $investment = $investmentQuery->first();

        if (! $investment) return response()->json(['message' => 'Investment not found'], 404);

        if ($this->hasFullReceipt((int) $investment->id, $userId)) {
            return response()->json([
                'message' => 'تم رفض إضافة السداد: يوجد سداد كلي مسجل سابقًا لنفس رقم الفرصة.',
                'data' => [
                    'blocked' => true,
                    'reason' => 'full_receipt_exists',
                    'investment' => $this->readInvestment((int) $investment->id, $userId),
                ],
            ], 409);
        }

        $receipt = $this->record($investment, [
            'amount' => round((float) $data['amount'], 2),
            'receipt_type' => $data['receipt_type'] ?? 'partial',
            'receipt_date' => $data['receipt_date'] ?? now()->toDateString(),
            'reference_number' => $investment->reference_number,
            'source_message' => $data['source_message'] ?? null,
            'notes' => $data['notes'] ?? null,
            'force_complete' => (bool) ($data['force_complete'] ?? false),
            'allow_duplicate' => (bool) ($data['allow_duplicate'] ?? false),
        ]);

        return response()->json(['data' => ['receipt' => $receipt, 'investment' => $this->readInvestment($id, $userId)]]);
    }

    public function update(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $data = $request->validate([
            'receipt_date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        if (! Schema::hasTable('ta3meed_receipts')) {
            return response()->json(['message' => 'Receipt not found'], 404);
        }

        $receiptQuery = DB::table('ta3meed_receipts')->where('id', $id);
        $this->scopeUser($receiptQuery, 'ta3meed_receipts', $userId);
        $receipt = $receiptQuery->first();
        if (! $receipt) {
            return response()->json(['message' => 'Receipt not found'], 404);
        }

        $investmentBeforeQuery = DB::table('investment_opportunities')
            ->where('id', (int) $receipt->opportunity_id);
        $this->scopeUser($investmentBeforeQuery, 'investment_opportunities', $userId);
        $investmentBefore = $investmentBeforeQuery->first();
        if (! $investmentBefore) return response()->json(['message' => 'Investment not found'], 404);
        $previousOpportunityStatus = $investmentBefore->status ?? 'active';
        $previousCompletedAt = $investmentBefore->completed_at ?? null;
        $previousReceivedAt = $investmentBefore->received_at ?? null;

        $previousAllocationStatuses = collect();
        if (Schema::hasTable('investment_opportunity_allocations')) {
            $previousAllocationQuery = DB::table('investment_opportunity_allocations')
                ->where('opportunity_id', (int) $receipt->opportunity_id);
            $this->scopeUser($previousAllocationQuery, 'investment_opportunity_allocations', $userId);
            $previousAllocationStatuses = $previousAllocationQuery->pluck('status', 'id');
        }

        DB::transaction(function () use ($receipt, $data, $previousOpportunityStatus, $previousCompletedAt, $previousReceivedAt, $previousAllocationStatuses) {
            $update = [
                'receipt_date' => $data['receipt_date'],
                'updated_at' => now(),
            ];

            if (array_key_exists('notes', $data)) {
                $update['notes'] = $data['notes'];
            }

            DB::table('ta3meed_receipts')->where('id', $receipt->id)->update($update);

            if (Schema::hasTable('ta3meed_receipt_allocations')) {
                DB::table('ta3meed_receipt_allocations')
                    ->where('receipt_id', $receipt->id)
                    ->update(['updated_at' => now()]);
            }

            $opportunityUpdate = [
                'status' => $previousOpportunityStatus,
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('investment_opportunities', 'completed_at')) {
                $opportunityUpdate['completed_at'] = $previousCompletedAt;
            }
            if (Schema::hasColumn('investment_opportunities', 'received_at')) {
                $opportunityUpdate['received_at'] = $previousReceivedAt;
            }

            DB::table('investment_opportunities')
                ->where('id', (int) $receipt->opportunity_id)
                ->update($opportunityUpdate);

            if (Schema::hasTable('investment_opportunity_allocations')) {
                foreach ($previousAllocationStatuses as $allocationId => $status) {
                    DB::table('investment_opportunity_allocations')
                        ->where('id', (int) $allocationId)
                        ->update([
                            'status' => $status,
                            'updated_at' => now(),
                        ]);
                }
            }
        });

        return response()->json([
            'data' => [
                'updated' => true,
                'date_only' => true,
                'restored_status' => $previousOpportunityStatus,
                'receipt' => DB::table('ta3meed_receipts')->where('id', $id)->first(),
                'investment' => $this->readInvestment((int) $receipt->opportunity_id, $userId),
            ],
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $userId = $this->userId($request);
        if (! Schema::hasTable('ta3meed_receipts')) {
            return response()->json(['message' => 'Receipt not found'], 404);
        }

        $receiptQuery = DB::table('ta3meed_receipts')->where('id', $id);
        $this->scopeUser($receiptQuery, 'ta3meed_receipts', $userId);
        $receipt = $receiptQuery->first();
        if (! $receipt) {
            return response()->json(['message' => 'Receipt not found'], 404);
        }

        DB::transaction(function () use ($receipt) {
            if (Schema::hasTable('ta3meed_receipt_allocations')) {
                DB::table('ta3meed_receipt_allocations')->where('receipt_id', $receipt->id)->delete();
            }
            DB::table('ta3meed_receipts')->where('id', $receipt->id)->delete();
            $this->recalculate((int) $receipt->opportunity_id, false);
        });

        return response()->json(['data' => ['deleted' => true, 'investment' => $this->readInvestment((int) $receipt->opportunity_id, $userId)]]);
    }

    private function parseMessage(string $message): array
    {
        $normalized = $this->normalizeTa3meedMessage($message);
        preg_match('/(?:بقيمة|مبلغ)\s*([0-9]+(?:\.[0-9]+)?)/u', $normalized, $amountMatch);

        $reference = $this->parseOpportunityReference($normalized);

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

    private function normalizeTa3meedMessage(string $message): string
    {
        $normalized = str_replace([
            "\u{200f}",
            "\u{200e}",
            "\u{202a}",
            "\u{202b}",
            "\u{202c}",
            "\u{202d}",
            "\u{202e}",
            ',',
            '٬',
        ], ['', '', '', '', '', '', '', '', ''], $message);

        $normalized = strtr($normalized, [
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        ]);

        return trim($normalized);
    }

    private function parseOpportunityReference(string $normalized): ?string
    {
        $english = strtoupper($normalized);
        $patterns = [
            '/(?:للفرصه|للفرصة|الفرصه|الفرصة)\s*(?:رقم)?\s*(INV\s*[-–—]?\s*[A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*)/u',
            '/(?:رقم)\s*(INV\s*[-–—]?\s*[A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*)/u',
            '/\b(INV\s*[-–—]?\s*[A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*)\b/u',
            '/(?:للفرصه|للفرصة|الفرصه|الفرصة)\s*(?:رقم)?\s*([A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*)/u',
            '/(?:رقم)\s*([A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*)/u',
            '/\b([A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*)\b/u',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $english, $match)) {
                return $this->cleanOpportunityReference($match[1]);
            }
        }

        return null;
    }

    private function cleanOpportunityReference(string $reference): string
    {
        $reference = strtoupper(trim($reference));
        $reference = preg_replace('/\s+/', '', $reference) ?: $reference;
        $reference = str_replace(['–', '—'], '-', $reference);
        $reference = preg_replace('/[^A-Z0-9-]/', '', $reference) ?: $reference;
        $reference = preg_replace('/^INV(?=[A-Z0-9])/', 'INV-', $reference) ?: $reference;
        return $reference;
    }

    private function findInvestmentByReference(int $platformId, string $reference, int $userId)
    {
        $normalizedReference = $this->cleanOpportunityReference($reference);
        $withoutDash = str_replace('-', '', $normalizedReference);

        $query = DB::table('investment_opportunities')
            ->where('platform_id', $platformId)
            ->where(function ($query) use ($normalizedReference, $withoutDash) {
                $query->whereRaw('LOWER(reference_number) = ?', [strtolower($normalizedReference)])
                    ->orWhereRaw('LOWER(REPLACE(reference_number, "-", "")) = ?', [strtolower($withoutDash)]);
            });
        $this->scopeUser($query, 'investment_opportunities', $userId);
        return $query->first();
    }

    private function record($investment, array $data): array
    {
        return DB::transaction(function () use ($investment, $data) {
            $amount = round((float) $data['amount'], 2);
            $receiptType = $data['receipt_type'] ?? 'partial';
            $receiptDate = $data['receipt_date'] ?? now()->toDateString();
            $reference = $data['reference_number'] ?? $investment->reference_number;
            $sourceMessage = $data['source_message'] ?? null;
            $allowDuplicate = (bool) ($data['allow_duplicate'] ?? false);
            $receiptUserId = (int) ($investment->user_id ?? 0);

            if (! $allowDuplicate) {
                $duplicateQuery = DB::table('ta3meed_receipts')
                    ->where('opportunity_id', $investment->id)
                    ->where('reference_number', $reference)
                    ->where('amount', $amount)
                    ->where('receipt_type', $receiptType);
                if ($receiptUserId > 0) $this->scopeUser($duplicateQuery, 'ta3meed_receipts', $receiptUserId);

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
            }


            $receiptId = DB::table('ta3meed_receipts')->insertGetId([
                'opportunity_id' => $investment->id,
                'amount' => $amount,
                'receipt_type' => $receiptType,
                'receipt_date' => $receiptDate,
                'reference_number' => $reference,
                'source_message' => $sourceMessage,
                'notes' => $data['notes'] ?? null,
                'user_id' => $receiptUserId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $allocationsQuery = DB::table('investment_opportunity_allocations')->where('opportunity_id', $investment->id);
            if ($receiptUserId > 0) $this->scopeUser($allocationsQuery, 'investment_opportunity_allocations', $receiptUserId);
            $allocations = $allocationsQuery->get();
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
                    'user_id' => $receiptUserId,
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
                'confirmed_duplicate' => $allowDuplicate,
            ];
        });
    }

    private function recalculate(int $opportunityId, bool $forceComplete = false): void
    {
        $investment = DB::table('investment_opportunities')->where('id', $opportunityId)->first();
        if (! $investment) return;
        $userId = (int) ($investment->user_id ?? 0);

        $receiptQuery = DB::table('ta3meed_receipts')->where('opportunity_id', $opportunityId);
        if ($userId > 0) $this->scopeUser($receiptQuery, 'ta3meed_receipts', $userId);
        $totalReceived = round((float) $receiptQuery->sum('amount'), 2);
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
        if (Schema::hasColumn('investment_opportunities', 'completed_at')) $update['completed_at'] = $isComplete ? ($investment->completed_at ?: now()->toDateString()) : null;
        if (Schema::hasColumn('investment_opportunities', 'received_at')) $update['received_at'] = $isComplete ? ($investment->received_at ?: now()->toDateString()) : null;
        DB::table('investment_opportunities')->where('id', $opportunityId)->update($update);

        $allocationsQuery = DB::table('investment_opportunity_allocations')->where('opportunity_id', $opportunityId);
        if ($userId > 0) $this->scopeUser($allocationsQuery, 'investment_opportunity_allocations', $userId);
        $allocations = $allocationsQuery->get();
        foreach ($allocations as $allocation) {
            $receiptAllocationQuery = DB::table('ta3meed_receipt_allocations')->where('allocation_id', $allocation->id);
            if ($userId > 0) $this->scopeUser($receiptAllocationQuery, 'ta3meed_receipt_allocations', $userId);
            $received = round((float) $receiptAllocationQuery->sum('received_amount'), 2);
            DB::table('investment_opportunity_allocations')->where('id', $allocation->id)->update([
                'received_amount' => $received,
                'actual_profit_amount' => $isComplete ? round($received - (float) $allocation->invested_amount, 2) : 0,
                'status' => $status,
                'updated_at' => now(),
            ]);
        }
    }

    private function hasFullReceipt(int $opportunityId, int $userId): bool
    {
        if (! Schema::hasTable('ta3meed_receipts')) {
            return false;
        }

        $query = DB::table('ta3meed_receipts')
            ->where('opportunity_id', $opportunityId)
            ->where('receipt_type', 'full');
        $this->scopeUser($query, 'ta3meed_receipts', $userId);
        return $query->exists();
    }

    private function readInvestment(int $id, int $userId)
    {
        $itemQuery = DB::table('investment_opportunities')->where('id', $id);
        $this->scopeUser($itemQuery, 'investment_opportunities', $userId);
        $item = $itemQuery->first();
        if (! $item) return null;

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
                'investment_opportunity_allocations.actual_profit_amount',
                'investment_opportunity_allocations.received_amount',
                'investment_opportunity_allocations.status',
            ])->get();

        $receiptQuery = DB::table('ta3meed_receipts')->where('opportunity_id', $id);
        $this->scopeUser($receiptQuery, 'ta3meed_receipts', $userId);
        $item->receipts = $receiptQuery->orderByDesc('receipt_date')->orderByDesc('id')->get();
        return $item;
    }

    private function userId(Request $request): int
    {
        $id = (int) ($request->attributes->get('ahmed_user_id') ?: $request->header('X-Ahmed-User-Id', 0));
        if ($id > 0 && Schema::hasTable('users') && DB::table('users')->where('id', $id)->exists()) return $id;
        return Schema::hasTable('users') ? (int) (DB::table('users')->orderBy('id')->value('id') ?: 1) : 1;
    }

    private function scopeUser($query, string $table, int $userId): void
    {
        if (Schema::hasColumn($table, 'user_id')) $query->where($table . '.user_id', $userId);
    }
}
