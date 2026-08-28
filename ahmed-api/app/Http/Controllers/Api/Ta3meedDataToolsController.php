<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class Ta3meedDataToolsController extends Controller
{
    private const BACKUP_VERSION = 1;
    private const MAX_BACKUPS = 30;

    public function exportLink(Request $request)
    {
        $userId = $this->userId($request);
        $token = Str::random(64);
        Cache::put('ta3meed_excel_' . $token, $userId, now()->addMinutes(10));

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

        $userId = (int) Cache::pull('ta3meed_excel_' . $token, 0);
        if ($userId <= 0) {
            return response()->json(['message' => 'انتهت صلاحية رابط التصدير. أعد التصدير من التطبيق.'], 410);
        }

        $path = $this->buildExcelFile($userId);
        $filename = 'ta3meed-investments-' . now()->format('Y-m-d_H-i-s') . '.xlsx';

        return response()->download($path, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'private, no-store, max-age=0',
        ])->deleteFileAfterSend(true);
    }

    public function backups(Request $request)
    {
        $userId = $this->userId($request);
        return response()->json(['data' => $this->listBackups($userId)]);
    }

    public function createBackup(Request $request)
    {
        $userId = $this->userId($request);
        $backup = $this->writeBackup($userId, 'manual');
        return response()->json(['data' => $backup], 201);
    }

    public function restoreBackup(Request $request, string $id)
    {
        $userId = $this->userId($request);
        $payload = $this->readBackup($userId, $id);
        if (! $payload) {
            return response()->json(['message' => 'النسخة الاحتياطية غير موجودة أو غير صالحة.'], 404);
        }
        if ((int) ($payload['user_id'] ?? 0) !== $userId) {
            return response()->json(['message' => 'هذه النسخة لا تخص المستخدم الحالي.'], 403);
        }

        // Always preserve the current state before any destructive restore.
        $preRestore = $this->writeBackup($userId, 'pre_restore');

        try {
            $restored = DB::transaction(function () use ($userId, $payload) {
                return $this->restoreSnapshot($userId, (array) ($payload['data'] ?? []));
            }, 3);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'تعذر استرجاع النسخة. لم يتم اعتماد أي تغيير على البيانات.',
                'data' => ['pre_restore_backup' => $preRestore],
            ], 500);
        }

        return response()->json(['data' => [
            'restored' => true,
            'backup' => $this->backupSummary($payload, $this->backupPath($userId, $id)),
            'pre_restore_backup' => $preRestore,
            'counts' => $restored,
        ]]);
    }

    private function buildExcelFile(int $userId): string
    {
        $snapshot = $this->snapshot($userId);
        $data = $snapshot['data'];
        $opportunities = collect($data['opportunities'] ?? []);
        $investors = collect($data['investors'] ?? [])->keyBy('id');
        $allocations = collect($data['allocations'] ?? []);
        $receipts = collect($data['receipts'] ?? []);
        $receiptAllocations = collect($data['receipt_allocations'] ?? []);
        $accountEntries = collect($data['investor_account_entries'] ?? []);

        $allocationByOpportunity = $allocations->groupBy('opportunity_id');
        $opportunityById = $opportunities->keyBy('id');
        $receiptById = $receipts->keyBy('id');

        $flatHeaders = [
            'رقم الفرصة', 'العنوان', 'الحالة', 'مبلغ الفرصة', 'الربح المتوقع', 'الربح الفعلي', 'نسبة الربح',
            'تاريخ البدء', 'تاريخ السحب', 'تاريخ الاستحقاق', 'تاريخ الإكمال/الاستلام', 'التصنيف', 'عدد الأشهر',
            'المبلغ المتبقي', 'اسم الشركة', 'المهام', 'المنفذ', 'ملاحظات الفرصة',
            'المستثمر', 'رمز المستثمر', 'مبلغ المستثمر', 'ربح المستثمر المتوقع', 'ربح المستثمر الفعلي',
            'المبلغ المستلم للمستثمر', 'حالة المستثمر', 'ملاحظات توزيع المستثمر', 'كل بيانات metadata',
        ];
        $flatRows = [];
        foreach ($opportunities as $opportunity) {
            $meta = $this->decodeMetadata($opportunity['metadata'] ?? null);
            $rows = $allocationByOpportunity->get($opportunity['id'], collect());
            if ($rows->isEmpty()) $rows = collect([null]);
            foreach ($rows as $allocation) {
                $investor = $allocation ? $investors->get($allocation['investor_id']) : null;
                $flatRows[] = [
                    $opportunity['reference_number'] ?? '',
                    $opportunity['title'] ?? '',
                    $opportunity['status'] ?? '',
                    $opportunity['principal_amount'] ?? 0,
                    $opportunity['expected_profit_amount'] ?? 0,
                    $opportunity['actual_profit_amount'] ?? 0,
                    $opportunity['expected_rate'] ?? '',
                    $opportunity['start_date'] ?? '',
                    $meta['withdrawal_date'] ?? '',
                    $opportunity['maturity_date'] ?? '',
                    $opportunity['received_at'] ?? ($opportunity['completed_at'] ?? ''),
                    $meta['category'] ?? '',
                    $meta['months'] ?? '',
                    $meta['remaining_amount'] ?? '',
                    $meta['company_name'] ?? '',
                    $meta['tasks'] ?? '',
                    $meta['executor'] ?? '',
                    $opportunity['notes'] ?? '',
                    $investor['name'] ?? '',
                    $investor['code'] ?? '',
                    $allocation['invested_amount'] ?? '',
                    $allocation['expected_profit_amount'] ?? '',
                    $allocation['actual_profit_amount'] ?? '',
                    $allocation['received_amount'] ?? '',
                    $allocation['status'] ?? '',
                    $allocation['notes'] ?? '',
                    $opportunity['metadata'] ?? '',
                ];
            }
        }

        $receiptRows = [];
        foreach ($receipts as $receipt) {
            $opp = $opportunityById->get($receipt['opportunity_id']);
            $receiptRows[] = [
                $receipt['id'] ?? '', $opp['reference_number'] ?? '', $receipt['amount'] ?? 0,
                $receipt['receipt_type'] ?? '', $receipt['receipt_date'] ?? '', $receipt['reference_number'] ?? '',
                $receipt['source_message'] ?? '', $receipt['notes'] ?? '', $receipt['created_at'] ?? '', $receipt['updated_at'] ?? '',
            ];
        }

        $receiptAllocationRows = [];
        foreach ($receiptAllocations as $row) {
            $receipt = $receiptById->get($row['receipt_id']);
            $opp = $opportunityById->get($row['opportunity_id'] ?? ($receipt['opportunity_id'] ?? null));
            $investor = $investors->get($row['investor_id']);
            $receiptAllocationRows[] = [
                $row['id'] ?? '', $opp['reference_number'] ?? '', $row['receipt_id'] ?? '',
                $investor['name'] ?? '', $investor['code'] ?? '', $row['share_percent'] ?? 0,
                $row['received_amount'] ?? 0, $row['created_at'] ?? '', $row['updated_at'] ?? '',
            ];
        }

        $accountRows = [];
        foreach ($accountEntries as $entry) {
            $investor = $investors->get($entry['investor_id']);
            $accountRows[] = [
                $entry['id'] ?? '', $investor['name'] ?? '', $investor['code'] ?? '',
                $entry['amount'] ?? 0, $entry['entry_date'] ?? '', $entry['notes'] ?? '',
                $entry['created_at'] ?? '', $entry['updated_at'] ?? '',
            ];
        }

        $totalInvested = (float) $opportunities->sum(fn ($x) => (float) ($x['principal_amount'] ?? 0));
        $totalProfit = (float) $opportunities->sum(fn ($x) => (float) ($x['expected_profit_amount'] ?? 0));
        $summaryRows = [
            ['تاريخ التصدير', now()->format('Y-m-d H:i:s')],
            ['عدد الفرص', $opportunities->count()],
            ['عدد المستثمرين', $investors->count()],
            ['عدد توزيعات المستثمرين', $allocations->count()],
            ['عدد دفعات السداد', $receipts->count()],
            ['إجمالي مبالغ الفرص', $totalInvested],
            ['إجمالي الأرباح المتوقعة', $totalProfit],
        ];

        $sheets = [
            ['ملخص', ['البيان', 'القيمة'], $summaryRows],
            ['الفرص والمستثمرون', $flatHeaders, $flatRows],
            ['بيانات الفرص', $this->headersFor($opportunities->all()), $this->rowsFor($opportunities->all())],
            ['توزيع المستثمرين', $this->headersFor($allocations->all()), $this->rowsFor($allocations->all())],
            ['المستثمرون', $this->headersFor($investors->values()->all()), $this->rowsFor($investors->values()->all())],
            ['السداد', ['ID', 'رقم الفرصة', 'المبلغ', 'نوع السداد', 'تاريخ السداد', 'مرجع السداد', 'نص الرسالة', 'ملاحظات', 'أنشئ في', 'حدث في'], $receiptRows],
            ['توزيع السداد', ['ID', 'رقم الفرصة', 'ID السداد', 'المستثمر', 'رمز المستثمر', 'النسبة %', 'المبلغ المستلم', 'أنشئ في', 'حدث في'], $receiptAllocationRows],
            ['حسابات المستثمرين', ['ID', 'المستثمر', 'رمز المستثمر', 'المبلغ', 'التاريخ', 'ملاحظات', 'أنشئ في', 'حدث في'], $accountRows],
        ];

        return $this->writeXlsx($sheets);
    }

    private function writeXlsx(array $sheets): string
    {
        $files = [];
        $sheetOverrides = [];
        $workbookSheets = [];
        $rels = [];

        foreach (array_values($sheets) as $index => $sheet) {
            [$name, $headers, $rows] = $sheet;
            $sheetNo = $index + 1;
            $safeName = mb_substr((string) $name, 0, 31);
            $sheetOverrides[] = '<Override PartName="/xl/worksheets/sheet' . $sheetNo . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
            $workbookSheets[] = '<sheet name="' . $this->xml($safeName) . '" sheetId="' . $sheetNo . '" r:id="rId' . $sheetNo . '"/>';
            $rels[] = '<Relationship Id="rId' . $sheetNo . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $sheetNo . '.xml"/>';
            $files['xl/worksheets/sheet' . $sheetNo . '.xml'] = $this->worksheetXml((array) $headers, (array) $rows);
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

        $path = tempnam(sys_get_temp_dir(), 'ta3meed_xlsx_');
        $this->writeStoredZip($path, $files);
        return $path;
    }

    private function worksheetXml(array $headers, array $rows): string
    {
        if (! $headers) $headers = ['البيانات'];
        $columnCount = max(1, count($headers));
        $lastColumn = $this->excelColumn($columnCount);
        $rowXml = [];
        $rowXml[] = $this->xlsxRow(1, $headers, true);
        foreach ($rows as $i => $row) {
            $values = array_values((array) $row);
            if (count($values) < $columnCount) $values = array_pad($values, $columnCount, '');
            if (count($values) > $columnCount) $values = array_slice($values, 0, $columnCount);
            $rowXml[] = $this->xlsxRow($i + 2, $values, false);
        }

        $cols = '';
        for ($i = 1; $i <= $columnCount; $i++) {
            $width = $i === 1 ? 18 : ($columnCount > 12 ? 16 : 22);
            $cols .= '<col min="' . $i . '" max="' . $i . '" width="' . $width . '" customWidth="1"/>';
        }

        $lastRow = max(1, count($rows) + 1);
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            . '<sheetFormatPr defaultRowHeight="18"/><cols>' . $cols . '</cols><sheetData>' . implode('', $rowXml) . '</sheetData>'
            . '<autoFilter ref="A1:' . $lastColumn . $lastRow . '"/></worksheet>';
    }

    private function xlsxRow(int $rowNumber, array $values, bool $header): string
    {
        $cells = [];
        foreach (array_values($values) as $index => $value) {
            $ref = $this->excelColumn($index + 1) . $rowNumber;
            if (! $header && $value !== '' && $value !== null && is_numeric($value)) {
                $cells[] = '<c r="' . $ref . '" s="2"><v>' . $this->xml((string) $value) . '</v></c>';
            } else {
                $text = $this->safeCellText($value);
                $cells[] = '<c r="' . $ref . '" t="inlineStr"' . ($header ? ' s="1"' : '') . '><is><t xml:space="preserve">' . $this->xml($text) . '</t></is></c>';
            }
        }
        return '<row r="' . $rowNumber . '"' . ($header ? ' ht="24" customHeight="1"' : '') . '>' . implode('', $cells) . '</row>';
    }

    private function stylesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts>'
            . '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills>'
            . '<borders count="2"><border/><border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            . '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            . '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
            . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
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
            $nameBytes = $name;
            $size = strlen($content);
            $crc = crc32($content);
            if ($crc < 0) $crc += 4294967296;
            $local = pack('VvvvvvVVVvv', 0x04034b50, 20, 0, 0, $dosTime, $dosDate, $crc, $size, $size, strlen($nameBytes), 0) . $nameBytes;
            fwrite($out, $local);
            fwrite($out, $content);
            $central[] = pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0, 0, $dosTime, $dosDate, $crc, $size, $size, strlen($nameBytes), 0, 0, 0, 0, 0, $offset) . $nameBytes;
            $offset += strlen($local) + $size;
        }

        $centralOffset = $offset;
        $centralData = implode('', $central);
        fwrite($out, $centralData);
        $centralSize = strlen($centralData);
        fwrite($out, pack('VvvvvVVv', 0x06054b50, 0, 0, count($central), count($central), $centralSize, $centralOffset, 0));
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

    private function headersFor(array $rows): array
    {
        $headers = [];
        foreach ($rows as $row) {
            foreach (array_keys((array) $row) as $key) {
                if (! in_array($key, $headers, true)) $headers[] = $key;
            }
        }
        return $headers ?: ['لا توجد بيانات'];
    }

    private function rowsFor(array $rows): array
    {
        $headers = $this->headersFor($rows);
        if ($headers === ['لا توجد بيانات']) return [];
        return array_map(function ($row) use ($headers) {
            $row = (array) $row;
            return array_map(fn ($key) => $row[$key] ?? '', $headers);
        }, $rows);
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

    private function snapshot(int $userId): array
    {
        $platform = $this->platform();
        if (! $platform) throw new \RuntimeException('Ta3meed platform not found.');

        $accounts = $this->rowsForUser('investment_accounts', $userId, fn ($q) => $q->where('platform_id', $platform->id));
        $opportunities = $this->rowsForUser('investment_opportunities', $userId, fn ($q) => $q->where('platform_id', $platform->id));
        $opportunityIds = collect($opportunities)->pluck('id')->map(fn ($id) => (int) $id)->all();

        $allocations = $this->rowsForUser('investment_opportunity_allocations', $userId, function ($q) use ($opportunityIds) {
            $opportunityIds ? $q->whereIn('opportunity_id', $opportunityIds) : $q->whereRaw('1=0');
        });
        $receipts = $this->rowsForUser('ta3meed_receipts', $userId, function ($q) use ($opportunityIds) {
            $opportunityIds ? $q->whereIn('opportunity_id', $opportunityIds) : $q->whereRaw('1=0');
        });
        $receiptIds = collect($receipts)->pluck('id')->map(fn ($id) => (int) $id)->all();
        $receiptAllocations = $this->rowsForUser('ta3meed_receipt_allocations', $userId, function ($q) use ($receiptIds, $opportunityIds) {
            if ($receiptIds) $q->whereIn('receipt_id', $receiptIds);
            elseif ($opportunityIds) $q->whereIn('opportunity_id', $opportunityIds);
            else $q->whereRaw('1=0');
        });
        $accountEntries = $this->rowsForUser('ta3meed_investor_account_entries', $userId);

        $investorIds = collect($allocations)->pluck('investor_id')
            ->merge(collect($receiptAllocations)->pluck('investor_id'))
            ->merge(collect($accountEntries)->pluck('investor_id'))
            ->filter()->map(fn ($id) => (int) $id)->unique()->values()->all();
        $investors = $this->rowsForUser('investment_investors', $userId, function ($q) use ($investorIds) {
            $investorIds ? $q->whereIn('id', $investorIds) : $q->whereRaw('1=0');
        });

        $data = [
            'accounts' => $accounts,
            'opportunities' => $opportunities,
            'investors' => $investors,
            'allocations' => $allocations,
            'receipts' => $receipts,
            'receipt_allocations' => $receiptAllocations,
            'investor_account_entries' => $accountEntries,
        ];

        return [
            'version' => self::BACKUP_VERSION,
            'created_at' => now()->toIso8601String(),
            'user_id' => $userId,
            'counts' => array_map('count', $data),
            'data' => $data,
        ];
    }

    private function writeBackup(int $userId, string $reason): array
    {
        $payload = $this->snapshot($userId);
        $id = now()->format('Ymd_His') . '_' . Str::lower(Str::random(6));
        $payload['id'] = $id;
        $payload['reason'] = $reason;
        $path = $this->backupPath($userId, $id);
        File::ensureDirectoryExists(dirname($path));
        File::put($path, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        $this->pruneBackups($userId);
        return $this->backupSummary($payload, $path);
    }

    private function listBackups(int $userId): array
    {
        $dir = $this->backupDirectory($userId);
        if (! is_dir($dir)) return [];
        $files = collect(File::files($dir))->sortByDesc(fn ($file) => $file->getMTime())->take(self::MAX_BACKUPS);
        $result = [];
        foreach ($files as $file) {
            $decoded = json_decode(File::get($file->getPathname()), true);
            if (! is_array($decoded) || (int) ($decoded['user_id'] ?? 0) !== $userId) continue;
            $result[] = $this->backupSummary($decoded, $file->getPathname());
        }
        return $result;
    }

    private function readBackup(int $userId, string $id): ?array
    {
        if (! preg_match('/^[A-Za-z0-9_-]{10,80}$/', $id)) return null;
        $path = $this->backupPath($userId, $id);
        if (! is_file($path)) return null;
        $decoded = json_decode(File::get($path), true);
        return is_array($decoded) ? $decoded : null;
    }

    private function backupSummary(array $payload, string $path): array
    {
        return [
            'id' => $payload['id'] ?? pathinfo($path, PATHINFO_FILENAME),
            'created_at' => $payload['created_at'] ?? null,
            'reason' => $payload['reason'] ?? 'manual',
            'counts' => $payload['counts'] ?? [],
            'size_bytes' => is_file($path) ? filesize($path) : 0,
        ];
    }

    private function pruneBackups(int $userId): void
    {
        $dir = $this->backupDirectory($userId);
        if (! is_dir($dir)) return;
        $files = collect(File::files($dir))->sortByDesc(fn ($file) => $file->getMTime())->values();
        foreach ($files->slice(self::MAX_BACKUPS) as $file) @unlink($file->getPathname());
    }

    private function restoreSnapshot(int $userId, array $data): array
    {
        $platform = $this->platform();
        if (! $platform) throw new \RuntimeException('Ta3meed platform not found.');

        $backupAccounts = (array) ($data['accounts'] ?? []);
        $currentAccount = $this->firstForUser('investment_accounts', $userId, fn ($q) => $q->where('platform_id', $platform->id));
        if (! $currentAccount) {
            $accountRow = (array) ($backupAccounts[0] ?? [
                'display_name' => 'محفظة تعميد', 'currency' => 'SAR', 'wallet_balance' => 0,
                'total_invested_snapshot' => 0, 'is_active' => 1,
            ]);
            unset($accountRow['id']);
            $accountRow['platform_id'] = $platform->id;
            $accountRow = $this->forceUser($accountRow, 'investment_accounts', $userId);
            $accountRow = $this->filterColumns('investment_accounts', $accountRow);
            $accountId = (int) DB::table('investment_accounts')->insertGetId($accountRow);
        } else {
            $accountId = (int) $currentAccount->id;
            if ($backupAccounts) {
                $accountRow = (array) $backupAccounts[0];
                unset($accountRow['id'], $accountRow['user_id'], $accountRow['platform_id']);
                $accountRow = $this->filterColumns('investment_accounts', $accountRow);
                if ($accountRow) DB::table('investment_accounts')->where('id', $accountId)->update($accountRow);
            }
        }

        $currentOpportunities = $this->rowsForUser('investment_opportunities', $userId, fn ($q) => $q->where('platform_id', $platform->id));
        $currentOpportunityIds = collect($currentOpportunities)->pluck('id')->map(fn ($id) => (int) $id)->all();
        $currentReceiptIds = $this->idsForUser('ta3meed_receipts', $userId, 'opportunity_id', $currentOpportunityIds);

        if (Schema::hasTable('ta3meed_receipt_allocations')) {
            $q = DB::table('ta3meed_receipt_allocations');
            $this->scopeUser($q, 'ta3meed_receipt_allocations', $userId);
            if ($currentReceiptIds) $q->whereIn('receipt_id', $currentReceiptIds);
            elseif ($currentOpportunityIds) $q->whereIn('opportunity_id', $currentOpportunityIds);
            else $q->whereRaw('1=0');
            $q->delete();
        }
        if (Schema::hasTable('ta3meed_receipts')) {
            $q = DB::table('ta3meed_receipts'); $this->scopeUser($q, 'ta3meed_receipts', $userId);
            $currentOpportunityIds ? $q->whereIn('opportunity_id', $currentOpportunityIds) : $q->whereRaw('1=0');
            $q->delete();
        }
        if (Schema::hasTable('investment_opportunity_allocations')) {
            $q = DB::table('investment_opportunity_allocations'); $this->scopeUser($q, 'investment_opportunity_allocations', $userId);
            $currentOpportunityIds ? $q->whereIn('opportunity_id', $currentOpportunityIds) : $q->whereRaw('1=0');
            $q->delete();
        }
        if (Schema::hasTable('ta3meed_investor_account_entries')) {
            $q = DB::table('ta3meed_investor_account_entries'); $this->scopeUser($q, 'ta3meed_investor_account_entries', $userId); $q->delete();
        }
        if ($currentOpportunityIds) {
            $q = DB::table('investment_opportunities')->whereIn('id', $currentOpportunityIds);
            $this->scopeUser($q, 'investment_opportunities', $userId);
            $q->delete();
        }

        $investorMap = [];
        foreach ((array) ($data['investors'] ?? []) as $source) {
            $source = (array) $source;
            $oldId = (int) ($source['id'] ?? 0);
            $query = DB::table('investment_investors');
            $this->scopeUser($query, 'investment_investors', $userId);
            $query->where(function ($q) use ($source) {
                if (! empty($source['code'])) $q->where('code', $source['code']);
                if (! empty($source['name'])) $q->orWhere('name', $source['name']);
            });
            $existing = $query->first();
            $row = $source;
            unset($row['id']);
            $row = $this->forceUser($row, 'investment_investors', $userId);
            $row = $this->filterColumns('investment_investors', $row);
            if ($existing) {
                DB::table('investment_investors')->where('id', $existing->id)->update($row);
                $newId = (int) $existing->id;
            } else {
                $newId = (int) DB::table('investment_investors')->insertGetId($row);
            }
            if ($oldId > 0) $investorMap[$oldId] = $newId;
        }

        $opportunityMap = [];
        foreach ((array) ($data['opportunities'] ?? []) as $source) {
            $row = (array) $source;
            $oldId = (int) ($row['id'] ?? 0);
            unset($row['id']);
            $row['platform_id'] = $platform->id;
            $row['account_id'] = $accountId;
            $row = $this->forceUser($row, 'investment_opportunities', $userId);
            $row = $this->filterColumns('investment_opportunities', $row);
            $newId = (int) DB::table('investment_opportunities')->insertGetId($row);
            if ($oldId > 0) $opportunityMap[$oldId] = $newId;
        }

        $allocationMap = [];
        foreach ((array) ($data['allocations'] ?? []) as $source) {
            $row = (array) $source;
            $oldId = (int) ($row['id'] ?? 0);
            $oldOpportunity = (int) ($row['opportunity_id'] ?? 0);
            $oldInvestor = (int) ($row['investor_id'] ?? 0);
            if (! isset($opportunityMap[$oldOpportunity], $investorMap[$oldInvestor])) continue;
            unset($row['id']);
            $row['opportunity_id'] = $opportunityMap[$oldOpportunity];
            $row['investor_id'] = $investorMap[$oldInvestor];
            $row = $this->forceUser($row, 'investment_opportunity_allocations', $userId);
            $row = $this->filterColumns('investment_opportunity_allocations', $row);
            $newId = (int) DB::table('investment_opportunity_allocations')->insertGetId($row);
            if ($oldId > 0) $allocationMap[$oldId] = $newId;
        }

        $receiptMap = [];
        foreach ((array) ($data['receipts'] ?? []) as $source) {
            if (! Schema::hasTable('ta3meed_receipts')) break;
            $row = (array) $source;
            $oldId = (int) ($row['id'] ?? 0);
            $oldOpportunity = (int) ($row['opportunity_id'] ?? 0);
            if (! isset($opportunityMap[$oldOpportunity])) continue;
            unset($row['id']);
            $row['opportunity_id'] = $opportunityMap[$oldOpportunity];
            $row = $this->forceUser($row, 'ta3meed_receipts', $userId);
            $row = $this->filterColumns('ta3meed_receipts', $row);
            $newId = (int) DB::table('ta3meed_receipts')->insertGetId($row);
            if ($oldId > 0) $receiptMap[$oldId] = $newId;
        }

        foreach ((array) ($data['receipt_allocations'] ?? []) as $source) {
            if (! Schema::hasTable('ta3meed_receipt_allocations')) break;
            $row = (array) $source;
            $oldReceipt = (int) ($row['receipt_id'] ?? 0);
            $oldOpportunity = (int) ($row['opportunity_id'] ?? 0);
            if (! isset($receiptMap[$oldReceipt], $opportunityMap[$oldOpportunity])) continue;
            unset($row['id']);
            $row['receipt_id'] = $receiptMap[$oldReceipt];
            $row['opportunity_id'] = $opportunityMap[$oldOpportunity];
            if (! empty($row['allocation_id'])) $row['allocation_id'] = $allocationMap[(int) $row['allocation_id']] ?? null;
            if (! empty($row['investor_id'])) $row['investor_id'] = $investorMap[(int) $row['investor_id']] ?? null;
            $row = $this->forceUser($row, 'ta3meed_receipt_allocations', $userId);
            $row = $this->filterColumns('ta3meed_receipt_allocations', $row);
            DB::table('ta3meed_receipt_allocations')->insert($row);
        }

        foreach ((array) ($data['investor_account_entries'] ?? []) as $source) {
            if (! Schema::hasTable('ta3meed_investor_account_entries')) break;
            $row = (array) $source;
            $oldInvestor = (int) ($row['investor_id'] ?? 0);
            if (! isset($investorMap[$oldInvestor])) continue;
            unset($row['id']);
            $row['investor_id'] = $investorMap[$oldInvestor];
            $row = $this->forceUser($row, 'ta3meed_investor_account_entries', $userId);
            $row = $this->filterColumns('ta3meed_investor_account_entries', $row);
            DB::table('ta3meed_investor_account_entries')->insert($row);
        }

        return [
            'opportunities' => count($opportunityMap),
            'investors' => count($investorMap),
            'allocations' => count($allocationMap),
            'receipts' => count($receiptMap),
        ];
    }

    private function rowsForUser(string $table, int $userId, ?callable $callback = null): array
    {
        if (! Schema::hasTable($table)) return [];
        $query = DB::table($table);
        $this->scopeUser($query, $table, $userId);
        if ($callback) $callback($query);
        return $query->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
    }

    private function firstForUser(string $table, int $userId, ?callable $callback = null)
    {
        if (! Schema::hasTable($table)) return null;
        $query = DB::table($table);
        $this->scopeUser($query, $table, $userId);
        if ($callback) $callback($query);
        return $query->first();
    }

    private function idsForUser(string $table, int $userId, string $foreignKey, array $ids): array
    {
        if (! Schema::hasTable($table) || ! $ids) return [];
        $query = DB::table($table)->whereIn($foreignKey, $ids);
        $this->scopeUser($query, $table, $userId);
        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    private function filterColumns(string $table, array $row): array
    {
        if (! Schema::hasTable($table)) return [];
        $columns = array_flip(Schema::getColumnListing($table));
        return array_intersect_key($row, $columns);
    }

    private function forceUser(array $row, string $table, int $userId): array
    {
        if (Schema::hasColumn($table, 'user_id')) $row['user_id'] = $userId;
        return $row;
    }

    private function decodeMetadata($metadata): array
    {
        if (is_array($metadata)) return $metadata;
        $decoded = json_decode((string) $metadata, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function backupDirectory(int $userId): string
    {
        return storage_path('app/private/ta3meed-backups/user-' . $userId);
    }

    private function backupPath(int $userId, string $id): string
    {
        return $this->backupDirectory($userId) . DIRECTORY_SEPARATOR . $id . '.json';
    }

    private function platform()
    {
        return Schema::hasTable('investment_platforms')
            ? DB::table('investment_platforms')->where('code', 'ta3meed')->first()
            : null;
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
}
