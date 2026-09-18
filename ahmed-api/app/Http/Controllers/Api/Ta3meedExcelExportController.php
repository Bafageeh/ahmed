<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class Ta3meedExcelExportController extends Ta3meedDataToolsController
{
    private const TOKEN_PREFIX = 'ta3meed_excel_';

    public function exportLink(Request $request)
    {
        $userId = $this->userId($request);
        $token = Str::random(64);
        Cache::put(self::TOKEN_PREFIX . $token, $userId, now()->addMinutes(10));

        return response()->json(['data' => [
            'url' => url('/api/ta3meed/export-download/' . $token),
            'expires_in_seconds' => 600,
        ]]);
    }

    public function downloadExport(string $token)
    {
        if (! preg_match('/^[A-Za-z0-9]{40,100}$/', $token)) {
            abort(404);
        }

        $userId = (int) Cache::pull(self::TOKEN_PREFIX . $token, 0);
        if ($userId <= 0) {
            return response()->json(['message' => 'انتهت صلاحية رابط التصدير. أعد التصدير من التطبيق.'], 410);
        }

        try {
            $path = $this->buildExcelFile($userId);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['message' => 'تعذر إنشاء ملف Excel.'], 500);
        }

        $filename = 'استثمار_تعميد_' . now()->format('Y-m-d') . '.xlsx';

        return response()->download($path, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'private, no-store, max-age=0',
        ])->deleteFileAfterSend(true);
    }

    private function buildExcelFile(int $userId): string
    {
        $platform = DB::table('investment_platforms')->where('code', 'ta3meed')->first();
        if (! $platform) {
            throw new \RuntimeException('Ta3meed platform not found.');
        }

        $opportunities = $this->rowsForUser(
            'investment_opportunities',
            $userId,
            fn ($q) => $q->where('platform_id', $platform->id)->orderByDesc('maturity_date')->orderByDesc('id')
        );
        $opportunitiesById = collect($opportunities)->keyBy('id');
        $opportunityIds = $opportunitiesById->keys()->map(fn ($id) => (int) $id)->all();

        $allocations = $this->rowsForUser('investment_opportunity_allocations', $userId, function ($q) use ($opportunityIds) {
            $opportunityIds ? $q->whereIn('opportunity_id', $opportunityIds) : $q->whereRaw('1=0');
        });

        $receipts = $this->rowsForUser('ta3meed_receipts', $userId, function ($q) use ($opportunityIds) {
            $opportunityIds ? $q->whereIn('opportunity_id', $opportunityIds) : $q->whereRaw('1=0');
        });
        $receiptIds = collect($receipts)->pluck('id')->filter()->map(fn ($id) => (int) $id)->all();

        $receiptAllocations = $this->rowsForUser('ta3meed_receipt_allocations', $userId, function ($q) use ($receiptIds) {
            $receiptIds ? $q->whereIn('receipt_id', $receiptIds) : $q->whereRaw('1=0');
        });

        $investorIds = collect($allocations)->pluck('investor_id')
            ->merge(collect($receiptAllocations)->pluck('investor_id'))
            ->filter()->map(fn ($id) => (int) $id)->unique()->values()->all();
        $investors = $this->rowsForUser('investment_investors', $userId, function ($q) use ($investorIds) {
            $investorIds ? $q->whereIn('id', $investorIds) : $q->whereRaw('1=0');
        });
        $investorsById = collect($investors)->keyBy('id');

        $allocationsByOpportunity = collect($allocations)->groupBy('opportunity_id');
        $receiptsByOpportunity = collect($receipts)->groupBy('opportunity_id');
        $receiptAllocationsByReceipt = collect($receiptAllocations)->groupBy('receipt_id');
        $receiptAllocationsByInvestor = collect($receiptAllocations)->groupBy('investor_id');
        $allocationReceivedByOpportunity = collect($allocations)->groupBy('opportunity_id')->map(
            fn ($rows) => (float) $rows->sum(fn ($row) => (float) ($row['received_amount'] ?? 0))
        );
        $receiptReceivedByOpportunity = collect($receipts)->groupBy('opportunity_id')->map(
            fn ($rows) => (float) $rows->sum(fn ($row) => (float) ($row['amount'] ?? 0))
        );

        $opportunityRows = [];
        $opportunityStats = [];
        foreach ($opportunities as $opportunity) {
            $id = (int) ($opportunity['id'] ?? 0);
            $meta = $this->metadata($opportunity['metadata'] ?? null);
            $principal = (float) ($opportunity['principal_amount'] ?? 0);
            $profit = (float) ($opportunity['expected_profit_amount'] ?? 0);
            $due = max(0, $principal + $profit);
            $paid = max(
                (float) ($receiptReceivedByOpportunity[$id] ?? 0),
                (float) ($allocationReceivedByOpportunity[$id] ?? 0),
                (float) ($meta['ta3meed_received_total'] ?? 0)
            );
            $rawStatus = strtolower(trim((string) ($opportunity['status'] ?? 'active')));
            if ($paid <= 0 && in_array($rawStatus, ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done'], true)) {
                $actualProfit = max(0, (float) ($opportunity['actual_profit_amount'] ?? 0));
                $paid = $principal + ($actualProfit > 0 ? $actualProfit : $profit);
            }
            $remaining = max(0, $due - $paid);
            $status = $this->statusLabel($opportunity, $paid, $due);
            $statusStyle = $this->statusStyle($status);

            $oppAllocations = collect($allocationsByOpportunity->get($id, []));
            $investorNames = $oppAllocations->map(function ($allocation) use ($investorsById) {
                $investor = $investorsById->get($allocation['investor_id'] ?? null);
                return trim((string) ($investor['name'] ?? $investor['code'] ?? ''));
            })->filter()->unique()->values()->all();

            $withdrawalDate = $meta['withdrawal_date'] ?? ($opportunity['start_date'] ?? null);
            $maturityDate = $opportunity['maturity_date'] ?? null;
            $days = $this->daysBetween($withdrawalDate, $maturityDate);
            $annualRate = (float) ($meta['registered_annual_profit_rate'] ?? $opportunity['expected_rate'] ?? 0);
            if ($annualRate <= 0 && $principal > 0 && $profit > 0) {
                $annualRate = ($profit / $principal) * 100;
            }

            $opportunityRows[] = [
                $this->c($opportunity['reference_number'] ?? ''),
                $this->c(implode('، ', $investorNames)),
                $this->c($meta['category'] ?? ''),
                $this->c($status, 'text', $statusStyle),
                $this->c($withdrawalDate, 'date'),
                $this->c($maturityDate, 'date'),
                $this->c($days, 'integer'),
                $this->c($principal, 'money'),
                $this->c($profit, 'money'),
                $this->c($due, 'money'),
                $this->c($paid, 'money'),
                $this->c($remaining, 'money'),
                $this->c($annualRate / 100, 'percent'),
                $this->c($opportunity['notes'] ?? ''),
            ];

            $opportunityStats[$id] = compact('principal', 'profit', 'due', 'paid', 'remaining', 'status', 'annualRate', 'rawStatus');
        }

        $includedStats = collect($opportunityStats)->filter(
            fn ($row) => ! in_array($row['rawStatus'], ['cancelled', 'canceled'], true)
        );
        $totalInvested = (float) $includedStats->sum('principal');
        $totalProfit = (float) $includedStats->sum('profit');
        $totalDue = (float) $includedStats->sum('due');
        $totalPaid = (float) $includedStats->sum('paid');
        $totalRemaining = (float) $includedStats->sum('remaining');
        $weightedRate = $totalInvested > 0
            ? (float) $includedStats->sum(fn ($row) => $row['principal'] * $row['annualRate']) / $totalInvested
            : 0;

        $investorRows = [];
        $investorSummaryPlain = [];
        foreach ($investors as $investor) {
            $investorId = (int) ($investor['id'] ?? 0);
            $investorAllocations = collect($allocations)->filter(function ($allocation) use ($investorId, $opportunityStats) {
                if ((int) ($allocation['investor_id'] ?? 0) !== $investorId) return false;
                $oppId = (int) ($allocation['opportunity_id'] ?? 0);
                $status = $opportunityStats[$oppId]['rawStatus'] ?? '';
                return ! in_array($status, ['cancelled', 'canceled'], true);
            });
            if ($investorAllocations->isEmpty()) continue;

            $invested = (float) $investorAllocations->sum(fn ($row) => (float) ($row['invested_amount'] ?? 0));
            $profit = (float) $investorAllocations->sum(fn ($row) => (float) ($row['expected_profit_amount'] ?? 0));
            $due = $invested + $profit;
            $receivedFromAllocations = (float) $investorAllocations->sum(fn ($row) => (float) ($row['received_amount'] ?? 0));
            $receivedFromReceipts = (float) collect($receiptAllocationsByInvestor->get($investorId, []))
                ->sum(fn ($row) => (float) ($row['received_amount'] ?? 0));
            $received = max($receivedFromAllocations, $receivedFromReceipts);
            $remaining = max(0, $due - $received);
            $opportunityCount = $investorAllocations->pluck('opportunity_id')->unique()->count();
            $averageReturn = $invested > 0 ? $profit / $invested : 0;
            $name = (string) ($investor['name'] ?? $investor['code'] ?? '');

            $investorSummaryPlain[] = compact('name', 'opportunityCount', 'invested', 'profit', 'due', 'received', 'remaining', 'averageReturn');
        }
        usort($investorSummaryPlain, fn ($a, $b) => strnatcasecmp($a['name'], $b['name']));
        $investorRows = array_map(fn ($row) => $this->investorCells($row), $investorSummaryPlain);

        $paymentRows = [];
        foreach ($receiptsByOpportunity as $opportunityId => $opportunityReceipts) {
            $opportunityId = (int) $opportunityId;
            $opportunity = $opportunitiesById->get($opportunityId);
            if (! $opportunity) continue;
            $stat = $opportunityStats[$opportunityId] ?? null;
            $due = (float) ($stat['due'] ?? 0);
            $runningPaid = 0;

            $sortedReceipts = collect($opportunityReceipts)->sortBy(function ($receipt) {
                return sprintf('%s-%012d', (string) ($receipt['receipt_date'] ?? $receipt['created_at'] ?? ''), (int) ($receipt['id'] ?? 0));
            });

            foreach ($sortedReceipts as $receipt) {
                $amount = (float) ($receipt['amount'] ?? 0);
                $before = max(0, $due - $runningPaid);
                $runningPaid += $amount;
                $after = max(0, $due - $runningPaid);
                $names = collect($receiptAllocationsByReceipt->get($receipt['id'] ?? null, []))->map(function ($allocation) use ($investorsById) {
                    $investor = $investorsById->get($allocation['investor_id'] ?? null);
                    return trim((string) ($investor['name'] ?? $investor['code'] ?? ''));
                })->filter()->unique()->values()->all();
                if (! $names) {
                    $names = collect($allocationsByOpportunity->get($opportunityId, []))->map(function ($allocation) use ($investorsById) {
                        $investor = $investorsById->get($allocation['investor_id'] ?? null);
                        return trim((string) ($investor['name'] ?? $investor['code'] ?? ''));
                    })->filter()->unique()->values()->all();
                }

                $paymentRows[] = [
                    'sort' => (string) ($receipt['receipt_date'] ?? $receipt['created_at'] ?? ''),
                    'cells' => [
                        $this->c($opportunity['reference_number'] ?? ''),
                        $this->c(implode('، ', $names)),
                        $this->c($receipt['receipt_date'] ?? $receipt['created_at'] ?? '', 'date'),
                        $this->c($amount, 'money'),
                        $this->c($before, 'money'),
                        $this->c($after, 'money'),
                        $this->c($receipt['notes'] ?? $receipt['source_message'] ?? ''),
                    ],
                ];
            }
        }
        usort($paymentRows, fn ($a, $b) => strcmp($b['sort'], $a['sort']));
        $paymentCells = array_map(fn ($row) => $row['cells'], $paymentRows);

        $summaryMetrics = [
            ['إجمالي عدد الفرص', $includedStats->count(), 'integer'],
            ['إجمالي رأس المال المستثمر', $totalInvested, 'money'],
            ['إجمالي الأرباح', $totalProfit, 'money'],
            ['إجمالي المستحق', $totalDue, 'money'],
            ['إجمالي المسدد', $totalPaid, 'money'],
            ['إجمالي المتبقي', $totalRemaining, 'money'],
            ['متوسط نسبة الربح', $weightedRate / 100, 'percent'],
            ['عدد المستثمرين', count($investorSummaryPlain), 'integer'],
        ];

        $opportunityTotals = [
            $this->c('الإجمالي', 'text', 6), $this->c('', 'text', 6), $this->c('', 'text', 6), $this->c('', 'text', 6),
            $this->c('', 'text', 6), $this->c('', 'text', 6), $this->c('', 'text', 6),
            $this->c($totalInvested, 'money', 15), $this->c($totalProfit, 'money', 15), $this->c($totalDue, 'money', 15),
            $this->c($totalPaid, 'money', 15), $this->c($totalRemaining, 'money', 15), $this->c($weightedRate / 100, 'percent', 16), $this->c('', 'text', 6),
        ];

        $investorTotal = [
            $this->c('الإجمالي', 'text', 6),
            $this->c(collect($investorSummaryPlain)->sum('opportunityCount'), 'integer', 6),
            $this->c(collect($investorSummaryPlain)->sum('invested'), 'money', 15),
            $this->c(collect($investorSummaryPlain)->sum('profit'), 'money', 15),
            $this->c(collect($investorSummaryPlain)->sum('due'), 'money', 15),
            $this->c(collect($investorSummaryPlain)->sum('received'), 'money', 15),
            $this->c(collect($investorSummaryPlain)->sum('remaining'), 'money', 15),
            $this->c($totalInvested > 0 ? $totalProfit / $totalInvested : 0, 'percent', 16),
        ];

        $paymentTotal = [
            $this->c('الإجمالي', 'text', 6), $this->c('', 'text', 6), $this->c('', 'text', 6),
            $this->c(collect($receipts)->sum(fn ($row) => (float) ($row['amount'] ?? 0)), 'money', 15),
            $this->c('', 'text', 6), $this->c('', 'text', 6), $this->c('', 'text', 6),
        ];

        $files = [];
        $sheets = [
            ['name' => 'الملخص', 'xml' => $this->summarySheetXml($summaryMetrics, $investorSummaryPlain)],
            [
                'name' => 'الفرص',
                'xml' => $this->tableSheetXml(
                    'فرص استثمار تعميد',
                    ['رقم الفرصة', 'المستثمر', 'التصنيف', 'الحالة', 'تاريخ السحب', 'تاريخ الانتهاء', 'المدة بالأيام', 'المبلغ المستثمر', 'الربح', 'إجمالي المستحق', 'المدفوع', 'المتبقي', 'نسبة الربح السنوية', 'ملاحظات'],
                    $opportunityRows,
                    [18, 24, 12, 20, 15, 15, 14, 18, 18, 18, 18, 18, 18, 34],
                    $opportunityTotals
                ),
            ],
            [
                'name' => 'حسابات المستثمرين',
                'xml' => $this->tableSheetXml(
                    'حسابات مستثمري تعميد',
                    ['المستثمر', 'عدد الفرص', 'إجمالي المستثمر', 'إجمالي الأرباح', 'إجمالي المستحق', 'إجمالي المستلم', 'المتبقي', 'متوسط العائد'],
                    $investorRows,
                    [24, 14, 20, 20, 20, 20, 20, 18],
                    $investorTotal
                ),
            ],
            [
                'name' => 'السداد',
                'xml' => $this->tableSheetXml(
                    'سجل سداد تعميد',
                    ['رقم الفرصة', 'المستثمر', 'تاريخ السداد', 'مبلغ السداد', 'الرصيد قبل السداد', 'الرصيد بعد السداد', 'ملاحظات'],
                    $paymentCells,
                    [18, 24, 16, 18, 20, 20, 38],
                    $paymentTotal
                ),
            ],
        ];

        $sheetOverrides = [];
        $workbookSheets = [];
        $rels = [];
        foreach ($sheets as $index => $sheet) {
            $sheetNo = $index + 1;
            $sheetOverrides[] = '<Override PartName="/xl/worksheets/sheet' . $sheetNo . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
            $workbookSheets[] = '<sheet name="' . $this->xml($sheet['name']) . '" sheetId="' . $sheetNo . '" r:id="rId' . $sheetNo . '"/>';
            $rels[] = '<Relationship Id="rId' . $sheetNo . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $sheetNo . '.xml"/>';
            $files['xl/worksheets/sheet' . $sheetNo . '.xml'] = $sheet['xml'];
        }

        $styleRelId = count($sheets) + 1;
        $rels[] = '<Relationship Id="rId' . $styleRelId . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';

        $files['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . implode('', $sheetOverrides) . '</Types>';
        $files['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>';
        $files['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<bookViews><workbookView/></bookViews><sheets>' . implode('', $workbookSheets) . '</sheets></workbook>';
        $files['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . implode('', $rels) . '</Relationships>';
        $files['xl/styles.xml'] = $this->stylesXml();

        $path = tempnam(sys_get_temp_dir(), 'ta3meed_excel_');
        if ($path === false) throw new \RuntimeException('Unable to create temporary Excel file.');
        $this->writeStoredZip($path, $files);
        return $path;
    }

    private function investorCells(array $row): array
    {
        return [
            $this->c($row['name']),
            $this->c($row['opportunityCount'], 'integer'),
            $this->c($row['invested'], 'money'),
            $this->c($row['profit'], 'money'),
            $this->c($row['due'], 'money'),
            $this->c($row['received'], 'money'),
            $this->c($row['remaining'], 'money'),
            $this->c($row['averageReturn'], 'percent'),
        ];
    }

    private function summarySheetXml(array $metrics, array $investors): string
    {
        $headers = ['المستثمر', 'عدد الفرص', 'إجمالي المستثمر', 'إجمالي الأرباح', 'إجمالي المستحق', 'إجمالي المستلم', 'المتبقي', 'متوسط العائد'];
        $rows = [];
        $rows[] = $this->rowXml(1, [$this->c('ملخص استثمار تعميد', 'text', 5)]);
        $rows[] = $this->rowXml(2, [$this->c('تاريخ التصدير: ' . now()->format('d/m/Y H:i'), 'text', 17)]);
        $rows[] = $this->rowXml(4, [$this->c('المؤشرات الإجمالية', 'text', 12)]);

        for ($i = 0; $i < 4; $i++) {
            $left = $metrics[$i * 2] ?? null;
            $right = $metrics[$i * 2 + 1] ?? null;
            $cells = [];
            if ($left) {
                $cells[] = $this->c($left[0], 'text', 12);
                $cells[] = $this->c($left[1], $left[2]);
            } else {
                $cells[] = $this->c('');
                $cells[] = $this->c('');
            }
            $cells[] = $this->c('');
            $cells[] = $this->c('');
            if ($right) {
                $cells[] = $this->c($right[0], 'text', 12);
                $cells[] = $this->c($right[1], $right[2]);
            } else {
                $cells[] = $this->c('');
                $cells[] = $this->c('');
            }
            $cells[] = $this->c('');
            $cells[] = $this->c('');
            $rows[] = $this->rowXml(5 + $i, $cells);
        }

        $rows[] = $this->rowXml(10, [$this->c('ملخص المستثمرين', 'text', 12)]);
        $headerCells = array_map(fn ($header) => $this->c($header, 'text', 1), $headers);
        $rows[] = $this->rowXml(11, $headerCells, 28);

        $rowNumber = 12;
        foreach ($investors as $investor) {
            $rows[] = $this->rowXml($rowNumber++, $this->investorCells($investor));
        }

        $lastInvestorRow = max(11, $rowNumber - 1);
        $widths = [24, 14, 20, 20, 20, 20, 20, 18];
        $cols = $this->columnsXml($widths);
        $filter = $investors ? '<autoFilter ref="A11:H' . $lastInvestorRow . '"/>' : '';
        $merges = '<mergeCells count="4"><mergeCell ref="A1:H1"/><mergeCell ref="A2:H2"/><mergeCell ref="A4:H4"/><mergeCell ref="A10:H10"/></mergeCells>';

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            . '<sheetFormatPr defaultRowHeight="20"/><cols>' . $cols . '</cols><sheetData>' . implode('', $rows) . '</sheetData>'
            . $filter . $merges . '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
    }

    private function tableSheetXml(string $title, array $headers, array $rows, array $widths, ?array $totalRow = null): string
    {
        $columnCount = count($headers);
        $lastColumn = $this->excelColumn($columnCount);
        $xmlRows = [
            $this->rowXml(1, [$this->c($title, 'text', 5)], 30),
            $this->rowXml(2, array_map(fn ($header) => $this->c($header, 'text', 1), $headers), 28),
        ];
        $rowNumber = 3;
        foreach ($rows as $row) {
            $xmlRows[] = $this->rowXml($rowNumber++, $row);
        }
        $lastDataRow = max(2, $rowNumber - 1);
        if ($totalRow !== null) {
            $xmlRows[] = $this->rowXml($rowNumber++, $totalRow, 24);
        }

        $filter = $rows ? '<autoFilter ref="A2:' . $lastColumn . $lastDataRow . '"/>' : '';
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            . '<sheetFormatPr defaultRowHeight="20"/><cols>' . $this->columnsXml($widths) . '</cols><sheetData>' . implode('', $xmlRows) . '</sheetData>'
            . $filter
            . '<mergeCells count="1"><mergeCell ref="A1:' . $lastColumn . '1"/></mergeCells>'
            . '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
    }

    private function rowXml(int $rowNumber, array $cells, int $height = 22): string
    {
        $result = [];
        foreach (array_values($cells) as $index => $cell) {
            $cell = is_array($cell) && array_key_exists('v', $cell) ? $cell : $this->c($cell);
            $ref = $this->excelColumn($index + 1) . $rowNumber;
            $result[] = $this->cellXml($ref, $cell);
        }
        return '<row r="' . $rowNumber . '" ht="' . $height . '" customHeight="1">' . implode('', $result) . '</row>';
    }

    private function cellXml(string $ref, array $cell): string
    {
        $value = $cell['v'] ?? '';
        $type = $cell['t'] ?? 'text';
        $style = array_key_exists('s', $cell) && $cell['s'] !== null ? (int) $cell['s'] : $this->styleForType($type);

        if ($type === 'date') {
            $serial = $this->excelDate($value);
            if ($serial !== null) {
                return '<c r="' . $ref . '" s="' . $style . '"><v>' . $serial . '</v></c>';
            }
            $type = 'text';
            $style = 0;
        }

        if (in_array($type, ['money', 'percent', 'integer', 'number'], true) && $value !== '' && $value !== null && is_numeric($value)) {
            return '<c r="' . $ref . '" s="' . $style . '"><v>' . $this->xml((string) $value) . '</v></c>';
        }

        $text = $this->safeCellText($value);
        return '<c r="' . $ref . '" t="inlineStr" s="' . $style . '"><is><t xml:space="preserve">' . $this->xml($text) . '</t></is></c>';
    }

    private function c($value, string $type = 'text', ?int $style = null): array
    {
        return ['v' => $value, 't' => $type, 's' => $style];
    }

    private function styleForType(string $type): int
    {
        return match ($type) {
            'money' => 2,
            'percent' => 3,
            'date' => 4,
            'integer', 'number' => 13,
            default => 0,
        };
    }

    private function columnsXml(array $widths): string
    {
        $cols = [];
        foreach (array_values($widths) as $index => $width) {
            $column = $index + 1;
            $cols[] = '<col min="' . $column . '" max="' . $column . '" width="' . max(8, (float) $width) . '" customWidth="1"/>';
        }
        return implode('', $cols);
    }

    private function stylesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;ر.س&quot;"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>'
            . '<fonts count="5">'
            . '<font><sz val="11"/><name val="Arial"/></font>'
            . '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font>'
            . '<font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Arial"/></font>'
            . '<font><b/><color rgb="FF1E293B"/><sz val="11"/><name val="Arial"/></font>'
            . '<font><i/><color rgb="FF64748B"/><sz val="10"/><name val="Arial"/></font>'
            . '</fonts>'
            . '<fills count="10">'
            . '<fill><patternFill patternType="none"/></fill>'
            . '<fill><patternFill patternType="gray125"/></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FF6D4AFF"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FF342B7E"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFF1EEFF"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>'
            . '</fills>'
            . '<borders count="2"><border/><border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="18">'
            . $this->xf(0, 0, 0, 'right')
            . $this->xf(0, 1, 2, 'center')
            . $this->xf(164, 0, 0, 'center')
            . $this->xf(10, 0, 0, 'center')
            . $this->xf(165, 0, 0, 'center')
            . $this->xf(0, 2, 3, 'center')
            . $this->xf(0, 3, 4, 'right')
            . $this->xf(0, 3, 5, 'center')
            . $this->xf(0, 3, 6, 'center')
            . $this->xf(0, 3, 7, 'center')
            . $this->xf(0, 3, 8, 'center')
            . $this->xf(0, 3, 9, 'center')
            . $this->xf(0, 3, 4, 'right')
            . $this->xf(0, 0, 0, 'center')
            . $this->xf(0, 0, 0, 'center')
            . $this->xf(164, 3, 4, 'center')
            . $this->xf(10, 3, 4, 'center')
            . $this->xf(0, 4, 0, 'right', 0)
            . '</cellXfs>'
            . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    }

    private function xf(int $numFmtId, int $fontId, int $fillId, string $horizontal, int $borderId = 1): string
    {
        return '<xf numFmtId="' . $numFmtId . '" fontId="' . $fontId . '" fillId="' . $fillId . '" borderId="' . $borderId . '" xfId="0"'
            . ($numFmtId !== 0 ? ' applyNumberFormat="1"' : '')
            . ' applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="' . $horizontal . '" vertical="center" wrapText="1"/></xf>';
    }

    private function statusLabel(array $opportunity, float $paid, float $due): string
    {
        $raw = strtolower(trim((string) ($opportunity['status'] ?? 'active')));
        if (in_array($raw, ['cancelled', 'canceled'], true)) return 'ملغي';
        if (in_array($raw, ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done'], true)) return 'منتهي / مسدد بالكامل';
        if ($raw === 'partial_received' || ($paid > 0 && ($due <= 0 || $paid + 0.005 < $due))) return 'مسدد جزئيًا';
        $maturity = substr((string) ($opportunity['maturity_date'] ?? ''), 0, 10);
        if ($maturity !== '' && $maturity < now()->format('Y-m-d')) return 'متأخر';
        return 'نشط';
    }

    private function statusStyle(string $status): int
    {
        return match ($status) {
            'منتهي / مسدد بالكامل' => 7,
            'مسدد جزئيًا' => 8,
            'متأخر' => 9,
            'نشط' => 10,
            'ملغي' => 11,
            default => 0,
        };
    }

    private function metadata($value): array
    {
        if (is_array($value)) return $value;
        if (! is_string($value) || trim($value) === '') return [];
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function daysBetween($from, $to): ?int
    {
        $from = substr((string) ($from ?? ''), 0, 10);
        $to = substr((string) ($to ?? ''), 0, 10);
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) return null;
        try {
            return (new \DateTimeImmutable($from))->diff(new \DateTimeImmutable($to))->days;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function excelDate($value): ?float
    {
        $date = substr((string) ($value ?? ''), 0, 10);
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return null;
        try {
            $dt = new \DateTimeImmutable($date, new \DateTimeZone('UTC'));
            return ((float) $dt->format('U') / 86400) + 25569;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function rowsForUser(string $table, int $userId, ?callable $scope = null): array
    {
        if (! Schema::hasTable($table)) return [];
        $query = DB::table($table);
        if (Schema::hasColumn($table, 'user_id')) $query->where($table . '.user_id', $userId);
        if ($scope) $scope($query);
        return $query->get()->map(fn ($row) => (array) $row)->all();
    }

    private function userId(Request $request): int
    {
        $id = (int) $request->header('X-Ahmed-User-Id', 0);
        if ($id > 0 && Schema::hasTable('users') && DB::table('users')->where('id', $id)->exists()) return $id;
        return Schema::hasTable('users') ? (int) (DB::table('users')->orderBy('id')->value('id') ?: 1) : 1;
    }

    private function safeCellText($value): string
    {
        if (is_bool($value)) return $value ? 'نعم' : 'لا';
        if (is_array($value) || is_object($value)) $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $text = (string) ($value ?? '');
        if (mb_strlen($text) > 32000) $text = mb_substr($text, 0, 32000);
        return $text;
    }

    private function xml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    private function excelColumn(int $number): string
    {
        $result = '';
        while ($number > 0) {
            $number--;
            $result = chr(65 + ($number % 26)) . $result;
            $number = intdiv($number, 26);
        }
        return $result ?: 'A';
    }

    private function writeStoredZip(string $path, array $files): void
    {
        $out = fopen($path, 'wb');
        if (! $out) throw new \RuntimeException('Unable to create Excel file.');

        $central = [];
        $offset = 0;
        [$dosTime, $dosDate] = $this->dosDateTime();
        foreach ($files as $name => $content) {
            $name = str_replace('\\', '/', (string) $name);
            $content = (string) $content;
            $size = strlen($content);
            $crc = crc32($content);
            if ($crc < 0) $crc += 4294967296;
            $local = pack('VvvvvvVVVvv', 0x04034b50, 20, 0, 0, $dosTime, $dosDate, $crc, $size, $size, strlen($name), 0) . $name;
            fwrite($out, $local);
            fwrite($out, $content);
            $central[] = pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0, 0, $dosTime, $dosDate, $crc, $size, $size, strlen($name), 0, 0, 0, 0, 0, $offset) . $name;
            $offset += strlen($local) + $size;
        }

        $centralOffset = $offset;
        $centralData = implode('', $central);
        fwrite($out, $centralData);
        fwrite($out, pack('VvvvvVVv', 0x06054b50, 0, 0, count($central), count($central), strlen($centralData), $centralOffset, 0));
        fclose($out);
    }

    private function dosDateTime(): array
    {
        $t = getdate();
        $year = max(1980, (int) $t['year']);
        $time = (($t['hours'] & 0x1f) << 11) | (($t['minutes'] & 0x3f) << 5) | (intdiv((int) $t['seconds'], 2) & 0x1f);
        $date = ((($year - 1980) & 0x7f) << 9) | (($t['mon'] & 0x0f) << 5) | ($t['mday'] & 0x1f);
        return [$time, $date];
    }
}
