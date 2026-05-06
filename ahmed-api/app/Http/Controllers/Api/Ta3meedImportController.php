<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class Ta3meedImportController extends Controller
{
    private array $investorColumns = [
        'ahmed' => 'احمد',
        'sara' => 'سارة',
        'building' => 'المبنى',
        'amal' => 'امال',
        'mother' => 'امي',
        'father' => 'الوالد',
    ];

    public function finished(Request $request)
    {
        $data = $request->validate([
            'text' => ['required', 'string'],
            'replace_existing' => ['nullable', 'boolean'],
        ]);

        $platform = DB::table('investment_platforms')->where('code', 'ta3meed')->first();
        if (! $platform) {
            return response()->json(['message' => 'Ta3meed platform not found'], 404);
        }

        $accountId = $this->accountId((int) $platform->id);
        $rows = $this->parseRows($data['text']);

        if (! count($rows)) {
            return response()->json(['message' => 'لم يتم التعرف على أي استثمار منتهي'], 422);
        }

        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($rows, $platform, $accountId, $data, &$created, &$updated) {
            foreach ($rows as $row) {
                $existingId = DB::table('investment_opportunities')
                    ->where('platform_id', $platform->id)
                    ->where('reference_number', $row['code'])
                    ->value('id');

                if ($existingId && empty($data['replace_existing'])) {
                    continue;
                }

                if ($existingId) {
                    DB::table('investment_opportunity_allocations')->where('opportunity_id', $existingId)->delete();
                    DB::table('investment_opportunities')->where('id', $existingId)->update($this->opportunityPayload($row, $platform, $accountId));
                    $opportunityId = (int) $existingId;
                    $updated++;
                } else {
                    $opportunityId = DB::table('investment_opportunities')->insertGetId($this->opportunityPayload($row, $platform, $accountId));
                    $created++;
                }

                foreach ($row['allocations'] as $investorName => $amount) {
                    $amount = round((float) $amount, 2);
                    if ($amount <= 0) {
                        continue;
                    }
                    $investorId = $this->investorId($investorName);
                    $allocationProfit = $row['principal_amount'] > 0 ? round($row['expected_profit_amount'] * ($amount / $row['principal_amount']), 2) : 0;
                    DB::table('investment_opportunity_allocations')->insert([
                        'opportunity_id' => $opportunityId,
                        'investor_id' => $investorId,
                        'invested_amount' => $amount,
                        'expected_profit_amount' => $allocationProfit,
                        'actual_profit_amount' => $allocationProfit,
                        'received_amount' => $amount + $allocationProfit,
                        'status' => 'received',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        });

        return response()->json([
            'data' => [
                'parsed' => count($rows),
                'created' => $created,
                'updated' => $updated,
            ],
        ]);
    }

    private function parseRows(string $text): array
    {
        $lines = collect(preg_split('/\R/u', $text))
            ->map(fn ($line) => trim($line))
            ->filter()
            ->values()
            ->all();

        $rows = [];
        $currentCode = null;
        $tokens = [];

        foreach ($lines as $line) {
            if ($this->isHeader($line)) {
                continue;
            }

            if ($this->looksLikeCode($line)) {
                if ($currentCode && count($tokens) >= 5) {
                    $row = $this->buildRow($currentCode, $tokens);
                    if ($row) {
                        $rows[] = $row;
                    }
                }
                $currentCode = $line;
                $tokens = [];
                continue;
            }

            if ($currentCode) {
                $tokens[] = $line;
            }
        }

        if ($currentCode && count($tokens) >= 5) {
            $row = $this->buildRow($currentCode, $tokens);
            if ($row) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    private function buildRow(string $code, array $tokens): ?array
    {
        $dates = [];
        foreach ($tokens as $index => $token) {
            if ($this->parseDate($token)) {
                $dates[] = ['index' => $index, 'date' => $this->parseDate($token)];
            }
        }

        if (! count($dates)) {
            return null;
        }

        $firstDateIndex = $dates[0]['index'];
        $beforeDates = array_slice($tokens, 0, $firstDateIndex);
        $afterDates = array_slice($tokens, $firstDateIndex + count($dates));

        $categoryIndex = null;
        for ($i = count($beforeDates) - 1; $i >= 0; $i--) {
            if (preg_match('/^[A-C][+-]?$/u', trim($beforeDates[$i]))) {
                $categoryIndex = $i;
                break;
            }
        }

        if ($categoryIndex === null || $categoryIndex < 3) {
            return null;
        }

        $category = $beforeDates[$categoryIndex];
        $profit = $this->number($beforeDates[$categoryIndex - 1]);
        $rate = $this->number($beforeDates[$categoryIndex - 2]);
        $months = (int) round($this->number($beforeDates[$categoryIndex - 3]));
        $amountTokens = array_slice($beforeDates, 0, $categoryIndex - 3);
        $amounts = array_values(array_filter(array_map(fn ($token) => $this->number($token), $amountTokens), fn ($value) => $value > 0));

        if (! count($amounts) || $months <= 0) {
            return null;
        }

        $allocations = [];
        foreach ($amounts as $i => $amount) {
            $investorName = array_values($this->investorColumns)[$i] ?? 'مستثمر ' . ($i + 1);
            $allocations[$investorName] = ($allocations[$investorName] ?? 0) + $amount;
        }

        $principal = round(array_sum($amounts), 2);
        $startDate = $dates[0]['date'] ?? null;
        $maturityDate = $dates[1]['date'] ?? null;
        $exitDate = $dates[2]['date'] ?? null;

        $notes = trim(implode(' ', array_filter($afterDates, fn ($token) => ! $this->isMoney($token))));
        $receivedAmount = null;
        foreach ($afterDates as $token) {
            $value = $this->number($token);
            if ($value > 0) {
                $receivedAmount = $value;
            }
        }

        return [
            'code' => $code,
            'principal_amount' => $principal,
            'expected_profit_amount' => round($profit, 2),
            'actual_profit_amount' => round($profit, 2),
            'expected_rate' => $rate,
            'months' => $months,
            'category' => $category,
            'start_date' => $startDate,
            'maturity_date' => $maturityDate,
            'exit_date' => $exitDate,
            'received_amount' => $receivedAmount,
            'notes' => $notes ?: null,
            'allocations' => $allocations,
        ];
    }

    private function opportunityPayload(array $row, $platform, int $accountId): array
    {
        return [
            'account_id' => $accountId,
            'platform_id' => $platform->id,
            'title' => 'تعميد - ' . $row['code'],
            'reference_number' => $row['code'],
            'investment_type' => 'ta3meed',
            'principal_amount' => $row['principal_amount'],
            'expected_profit_amount' => $row['expected_profit_amount'],
            'actual_profit_amount' => $row['actual_profit_amount'],
            'expected_rate' => $row['expected_rate'],
            'start_date' => $row['start_date'],
            'maturity_date' => $row['maturity_date'],
            'completed_at' => $row['exit_date'],
            'status' => 'received',
            'profit_distribution' => 'at_maturity',
            'metadata' => json_encode([
                'category' => $row['category'],
                'months' => $row['months'],
                'withdrawal_date' => $row['exit_date'],
                'received_amount' => $row['received_amount'],
                'source' => 'bulk_finished_import',
            ], JSON_UNESCAPED_UNICODE),
            'notes' => $row['notes'],
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    private function looksLikeCode(string $line): bool
    {
        return preg_match('/^(?:PB-|INV-|Inv-)?[A-ZА-ЯЁ0-9-]{5,}$/u', trim($line)) === 1;
    }

    private function isHeader(string $line): bool
    {
        return in_array(trim($line), ['الكود', 'احمد', 'سارة', 'المبنى', 'امال', 'امي', 'الوالد', 'الشهور', 'نسبة الربح', 'الربح المحقق', 'تصنيف', 'تارخ الاستثمار', 'تاريخ الاستثمار', 'تاريخ الاستحقاق', 'تاريخ الخروج'], true);
    }

    private function isMoney(string $value): bool
    {
        return preg_match('/^-?[0-9,.]+%?$/', trim($value)) === 1;
    }

    private function number(string $value): float
    {
        $clean = str_replace([',', '%', ' '], '', trim($value));
        return is_numeric($clean) ? (float) $clean : 0.0;
    }

    private function parseDate(string $value): ?string
    {
        $value = trim($value);
        if (! preg_match('/^(\d{1,2})-(\d{1,2})-(\d{4})$/', $value, $m)) {
            return null;
        }
        $day = (int) $m[1];
        $month = (int) $m[2];
        $year = (int) $m[3];
        if ($year < 2000 || $month < 1 || $month > 12 || $day < 1 || $day > 31) {
            return null;
        }
        return sprintf('%04d-%02d-%02d', $year, $month, $day);
    }

    private function accountId(int $platformId): int
    {
        $id = DB::table('investment_accounts')->where('platform_id', $platformId)->value('id');
        if ($id) {
            return (int) $id;
        }
        return DB::table('investment_accounts')->insertGetId([
            'platform_id' => $platformId,
            'display_name' => 'محفظة تعميد',
            'currency' => 'SAR',
            'wallet_balance' => 0,
            'total_invested_snapshot' => 0,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function investorId(string $name): int
    {
        $codes = [
            'احمد' => 'ahmed',
            'أحمد' => 'ahmed',
            'سارة' => 'sara',
            'المبنى' => 'building',
            'امال' => 'amal',
            'أمال' => 'amal',
            'امي' => 'mother',
            'أمي' => 'mother',
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
}
