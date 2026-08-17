from pathlib import Path

PATH = Path('ahmed-api/app/Http/Controllers/Api/Ta3meedReceiptController.php')
text = PATH.read_text(encoding='utf-8')


def once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


once(
    "    private function applyMessageInternal(Request $request, bool $allowDuplicate)\n    {\n        $data = $request->validate([",
    "    private function applyMessageInternal(Request $request, bool $allowDuplicate)\n    {\n        $userId = $this->userId($request);\n        $data = $request->validate([",
    'apply user',
)
once(
    "        $investment = $this->findInvestmentByReference((int) $platform->id, $parsed['reference_number']);",
    "        $investment = $this->findInvestmentByReference((int) $platform->id, $parsed['reference_number'], $userId);",
    'apply opportunity scope',
)
text = text.replace("$this->hasFullReceipt((int) $investment->id)", "$this->hasFullReceipt((int) $investment->id, $userId)")
text = text.replace("$this->readInvestment((int) $investment->id)", "$this->readInvestment((int) $investment->id, $userId)")
text = text.replace("$this->readInvestment($investment->id)", "$this->readInvestment($investment->id, $userId)")

once(
    "    public function store(Request $request, int $id)\n    {\n        $data = $request->validate([",
    "    public function store(Request $request, int $id)\n    {\n        $userId = $this->userId($request);\n        $data = $request->validate([",
    'store user',
)
once(
    "        $investment = DB::table('investment_opportunities')\n            ->where('id', $id)\n            ->where('platform_id', $platform->id)\n            ->first();",
    "        $investmentQuery = DB::table('investment_opportunities')\n            ->where('id', $id)\n            ->where('platform_id', $platform->id);\n        $this->scopeUser($investmentQuery, 'investment_opportunities', $userId);\n        $investment = $investmentQuery->first();",
    'store investment scope',
)
text = text.replace("$this->readInvestment($id)", "$this->readInvestment($id, $userId)")

once(
    "    public function update(Request $request, int $id)\n    {\n        $data = $request->validate([",
    "    public function update(Request $request, int $id)\n    {\n        $userId = $this->userId($request);\n        $data = $request->validate([",
    'update user',
)
once(
    "        $receipt = DB::table('ta3meed_receipts')->where('id', $id)->first();",
    "        $receiptQuery = DB::table('ta3meed_receipts')->where('id', $id);\n        $this->scopeUser($receiptQuery, 'ta3meed_receipts', $userId);\n        $receipt = $receiptQuery->first();",
    'update receipt scope',
)
once(
    "        $investmentBefore = DB::table('investment_opportunities')\n            ->where('id', (int) $receipt->opportunity_id)\n            ->first();",
    "        $investmentBeforeQuery = DB::table('investment_opportunities')\n            ->where('id', (int) $receipt->opportunity_id);\n        $this->scopeUser($investmentBeforeQuery, 'investment_opportunities', $userId);\n        $investmentBefore = $investmentBeforeQuery->first();\n        if (! $investmentBefore) return response()->json(['message' => 'Investment not found'], 404);",
    'update investment scope',
)
once(
    "            $previousAllocationStatuses = DB::table('investment_opportunity_allocations')\n                ->where('opportunity_id', (int) $receipt->opportunity_id)\n                ->pluck('status', 'id');",
    "            $previousAllocationQuery = DB::table('investment_opportunity_allocations')\n                ->where('opportunity_id', (int) $receipt->opportunity_id);\n            $this->scopeUser($previousAllocationQuery, 'investment_opportunity_allocations', $userId);\n            $previousAllocationStatuses = $previousAllocationQuery->pluck('status', 'id');",
    'update allocation scope',
)
text = text.replace("'investment' => $this->readInvestment((int) $receipt->opportunity_id),", "'investment' => $this->readInvestment((int) $receipt->opportunity_id, $userId),")

once(
    "    public function destroy(int $id)\n    {",
    "    public function destroy(Request $request, int $id)\n    {\n        $userId = $this->userId($request);",
    'destroy user',
)
once(
    "        $receipt = DB::table('ta3meed_receipts')->where('id', $id)->first();",
    "        $receiptQuery = DB::table('ta3meed_receipts')->where('id', $id);\n        $this->scopeUser($receiptQuery, 'ta3meed_receipts', $userId);\n        $receipt = $receiptQuery->first();",
    'destroy receipt scope',
)
text = text.replace("'investment' => $this->readInvestment((int) $receipt->opportunity_id)]", "'investment' => $this->readInvestment((int) $receipt->opportunity_id, $userId)]")

once(
    "    private function findInvestmentByReference(int $platformId, string $reference)\n    {",
    "    private function findInvestmentByReference(int $platformId, string $reference, int $userId)\n    {",
    'find signature',
)
once(
    "        return DB::table('investment_opportunities')\n            ->where('platform_id', $platformId)\n            ->where(function ($query) use ($normalizedReference, $withoutDash) {\n                $query->whereRaw('LOWER(reference_number) = ?', [strtolower($normalizedReference)])\n                    ->orWhereRaw('LOWER(REPLACE(reference_number, \"-\", \"\")) = ?', [strtolower($withoutDash)]);\n            })\n            ->first();",
    "        $query = DB::table('investment_opportunities')\n            ->where('platform_id', $platformId)\n            ->where(function ($query) use ($normalizedReference, $withoutDash) {\n                $query->whereRaw('LOWER(reference_number) = ?', [strtolower($normalizedReference)])\n                    ->orWhereRaw('LOWER(REPLACE(reference_number, \"-\", \"\")) = ?', [strtolower($withoutDash)]);\n            });\n        $this->scopeUser($query, 'investment_opportunities', $userId);\n        return $query->first();",
    'find query',
)

once(
    "            $allowDuplicate = (bool) ($data['allow_duplicate'] ?? false);\n\n            if (! $allowDuplicate) {",
    "            $allowDuplicate = (bool) ($data['allow_duplicate'] ?? false);\n            $receiptUserId = (int) ($investment->user_id ?? 0);\n\n            if (! $allowDuplicate) {",
    'record user',
)
once(
    "                $duplicateQuery = DB::table('ta3meed_receipts')\n                    ->where('opportunity_id', $investment->id)\n                    ->where('reference_number', $reference)\n                    ->where('amount', $amount)\n                    ->where('receipt_type', $receiptType);",
    "                $duplicateQuery = DB::table('ta3meed_receipts')\n                    ->where('opportunity_id', $investment->id)\n                    ->where('reference_number', $reference)\n                    ->where('amount', $amount)\n                    ->where('receipt_type', $receiptType);\n                if ($receiptUserId > 0) $this->scopeUser($duplicateQuery, 'ta3meed_receipts', $receiptUserId);",
    'duplicate scope',
)
text = text.replace("\n            $receiptUserId = $investment->user_id ?? null;\n", "\n")
once(
    "            $allocations = DB::table('investment_opportunity_allocations')->where('opportunity_id', $investment->id)->get();",
    "            $allocationsQuery = DB::table('investment_opportunity_allocations')->where('opportunity_id', $investment->id);\n            if ($receiptUserId > 0) $this->scopeUser($allocationsQuery, 'investment_opportunity_allocations', $receiptUserId);\n            $allocations = $allocationsQuery->get();",
    'record allocations',
)

once(
    "        $investment = DB::table('investment_opportunities')->where('id', $opportunityId)->first();\n        if (! $investment) return;\n\n        $totalReceived = round((float) DB::table('ta3meed_receipts')->where('opportunity_id', $opportunityId)->sum('amount'), 2);",
    "        $investment = DB::table('investment_opportunities')->where('id', $opportunityId)->first();\n        if (! $investment) return;\n        $userId = (int) ($investment->user_id ?? 0);\n\n        $receiptQuery = DB::table('ta3meed_receipts')->where('opportunity_id', $opportunityId);\n        if ($userId > 0) $this->scopeUser($receiptQuery, 'ta3meed_receipts', $userId);\n        $totalReceived = round((float) $receiptQuery->sum('amount'), 2);",
    'recalc receipts',
)
once(
    "        if ($isComplete && Schema::hasColumn('investment_opportunities', 'completed_at')) $update['completed_at'] = now()->toDateString();\n        if ($isComplete && Schema::hasColumn('investment_opportunities', 'received_at')) $update['received_at'] = now()->toDateString();",
    "        if (Schema::hasColumn('investment_opportunities', 'completed_at')) $update['completed_at'] = $isComplete ? ($investment->completed_at ?: now()->toDateString()) : null;\n        if (Schema::hasColumn('investment_opportunities', 'received_at')) $update['received_at'] = $isComplete ? ($investment->received_at ?: now()->toDateString()) : null;",
    'clear stale completion dates',
)
once(
    "        $allocations = DB::table('investment_opportunity_allocations')->where('opportunity_id', $opportunityId)->get();\n        foreach ($allocations as $allocation) {\n            $received = round((float) DB::table('ta3meed_receipt_allocations')->where('allocation_id', $allocation->id)->sum('received_amount'), 2);",
    "        $allocationsQuery = DB::table('investment_opportunity_allocations')->where('opportunity_id', $opportunityId);\n        if ($userId > 0) $this->scopeUser($allocationsQuery, 'investment_opportunity_allocations', $userId);\n        $allocations = $allocationsQuery->get();\n        foreach ($allocations as $allocation) {\n            $receiptAllocationQuery = DB::table('ta3meed_receipt_allocations')->where('allocation_id', $allocation->id);\n            if ($userId > 0) $this->scopeUser($receiptAllocationQuery, 'ta3meed_receipt_allocations', $userId);\n            $received = round((float) $receiptAllocationQuery->sum('received_amount'), 2);",
    'recalc allocations',
)

once(
    "    private function hasFullReceipt(int $opportunityId): bool\n    {",
    "    private function hasFullReceipt(int $opportunityId, int $userId): bool\n    {",
    'full signature',
)
once(
    "        return DB::table('ta3meed_receipts')\n            ->where('opportunity_id', $opportunityId)\n            ->where('receipt_type', 'full')\n            ->exists();",
    "        $query = DB::table('ta3meed_receipts')\n            ->where('opportunity_id', $opportunityId)\n            ->where('receipt_type', 'full');\n        $this->scopeUser($query, 'ta3meed_receipts', $userId);\n        return $query->exists();",
    'full scope',
)

once(
    "    private function readInvestment(int $id)\n    {\n        $item = DB::table('investment_opportunities')->where('id', $id)->first();",
    "    private function readInvestment(int $id, int $userId)\n    {\n        $itemQuery = DB::table('investment_opportunities')->where('id', $id);\n        $this->scopeUser($itemQuery, 'investment_opportunities', $userId);\n        $item = $itemQuery->first();",
    'read investment',
)
once(
    "        $item->allocations = DB::table('investment_opportunity_allocations')\n            ->join('investment_investors', 'investment_opportunity_allocations.investor_id', '=', 'investment_investors.id')\n            ->where('investment_opportunity_allocations.opportunity_id', $id)\n            ->select([",
    "        $allocationQuery = DB::table('investment_opportunity_allocations')\n            ->join('investment_investors', 'investment_opportunity_allocations.investor_id', '=', 'investment_investors.id')\n            ->where('investment_opportunity_allocations.opportunity_id', $id);\n        $this->scopeUser($allocationQuery, 'investment_opportunity_allocations', $userId);\n        $item->allocations = $allocationQuery->select([",
    'read allocations',
)
once(
    "        $item->receipts = DB::table('ta3meed_receipts')->where('opportunity_id', $id)->orderByDesc('receipt_date')->orderByDesc('id')->get();\n        return $item;\n    }\n}",
    "        $receiptQuery = DB::table('ta3meed_receipts')->where('opportunity_id', $id);\n        $this->scopeUser($receiptQuery, 'ta3meed_receipts', $userId);\n        $item->receipts = $receiptQuery->orderByDesc('receipt_date')->orderByDesc('id')->get();\n        return $item;\n    }\n\n    private function userId(Request $request): int\n    {\n        $id = (int) ($request->attributes->get('ahmed_user_id') ?: $request->header('X-Ahmed-User-Id', 0));\n        if ($id > 0 && Schema::hasTable('users') && DB::table('users')->where('id', $id)->exists()) return $id;\n        return Schema::hasTable('users') ? (int) (DB::table('users')->orderBy('id')->value('id') ?: 1) : 1;\n    }\n\n    private function scopeUser($query, string $table, int $userId): void\n    {\n        if (Schema::hasColumn($table, 'user_id')) $query->where($table . '.user_id', $userId);\n    }\n}",
    'helpers',
)

if "findInvestmentByReference((int) $platform->id, $parsed['reference_number'], $userId)" not in text:
    raise SystemExit('scoped reference lookup missing')
if "->where($table . '.user_id', $userId)" not in text:
    raise SystemExit('scope helper missing')

PATH.write_text(text, encoding='utf-8')
print('Ta3meed receipt scope patched')
