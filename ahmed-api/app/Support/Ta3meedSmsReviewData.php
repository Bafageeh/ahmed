<?php

namespace App\Support;

/** Read independent facts for human review; never authorizes an automatic posting. */
final class Ta3meedSmsReviewData
{
    public static function extract(string $body, string $messageDate, string $messageDateSource): array
    {
        $text = Ta3meedSmsParser::normalize($body);
        $repayment = (bool) preg_match('/سداد|تسديد|repayment|fully\s+repaid/iu', $text);
        $deposit = (bool) preg_match('/[إا]يداع|شحن|deposit|top[ -]?up/iu', $text);
        $withdrawal = (bool) preg_match('/سحب|خصم|withdraw|deduct|تحويل.+(?:[إا]لى|لحسابك|لحسابكم).{0,40}(?:البنك|بنكي|البنكي)/iu', $text);
        $wallet = (bool) preg_match('/محفظ|حسابك|حسابكم|الحساب\s+الاستثماري|رصيدك|رصيدكم|wallet/iu', $text);
        $kind = $repayment ? ($withdrawal ? '' : 'repayment') : ($wallet && $deposit !== $withdrawal ? ($deposit ? 'deposit' : 'withdrawal') : '');

        // Unlike the automatic parser, a missing reference must not discard an amount or type.
        preg_match_all('/(?:بقيمة|بمبلغ|مبلغ(?:\s+السداد)?|القيمة(?:\s+المسددة)?|قيمة\s+العملية|amount(?:\s+of)?)\s*[:：=]?\s*([0-9][0-9,.]*)/iu', $text, $amounts);
        if (! $amounts[1]) preg_match_all('/([0-9][0-9,.]*)\s*(?:ريال(?:\s+سعودي)?|ر\.س|SAR)(?![A-Z])/iu', $text, $amounts);
        $amount = count($amounts[1]) === 1 ? self::money($amounts[1][0]) : '';
        // A fee-bearing message leaves the net debit for the reviewer to resolve.
        if (preg_match('/(?:رسوم|ضريبة|fees?|VAT)\s*[:：]?\s*[0-9]/iu', $text)) $amount = '';

        $upper = strtoupper($text);
        if ($repayment || $kind === '') {
            preg_match_all('/\bINV\s*-?\s*[A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*\b/u', $upper, $prefixed);
            preg_match_all('/(?:للفرص[ةه]|الفرص[ةه])\s*(?:رقم)?\s*[:：#]?\s*((?:INV\s*-?\s*)?[A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*)|رقم\s+الفرص[ةه]\s*[:：#]?\s*((?:INV\s*-?\s*)?[A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*)/u', $upper, $labelled);
            $references = array_merge($prefixed[0], array_filter($labelled[1]), array_filter($labelled[2]));
            $references = array_values(array_unique(array_map(fn ($ref) => preg_replace('/^INV(?=[A-Z0-9])/', 'INV-', preg_replace('/\s+/', '', $ref)), $references)));
        } else {
            preg_match_all('/(?:رقم\s+(?:العملية|الحركة|الحوالة|المرجع)|الرقم\s+المرجعي|مرجع(?:\s+العملية)?|reference|\bref)\s*[:：#-]?\s*([A-Z0-9][A-Z0-9-]{2,99})/iu', $text, $matches);
            $references = array_values(array_unique(array_map('strtoupper', $matches[1])));
        }
        $reference = count($references) === 1 ? $references[0] : '';

        $partial = (bool) preg_match('/جزئي|جزء|دفعة|قسط|partial/iu', $text);
        $early = (bool) preg_match('/(?:تسوية|سداد)\s+مبكر|early\s+settlement/iu', $text);
        $full = (bool) preg_match('/سداد\s+(?:كلي|كامل)|بالكامل|fully\s+repaid|final\s+repayment/iu', $text)
            || (! $partial && (bool) preg_match('/ر[اأ]س\s+المال\s+و[اأإ]?ل?ارباح|ر[اأ]س\s+المال\s+والأرباح/u', $text));
        $receiptType = $partial && ($early || $full) ? '' : ($early ? 'early_settlement' : ($full ? 'full' : ($partial ? 'partial' : '')));

        preg_match_all('/(?<![0-9])(?:[0-9]{4}[-\/][0-9]{1,2}[-\/][0-9]{1,2}|[0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{4})(?![0-9])/u', $text, $dates);
        $dates = array_values(array_unique($dates[0]));
        $date = $dates ? (count($dates) === 1 ? self::date($dates[0]) : '') : $messageDate;
        $today = (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Riyadh')))->format('Y-m-d');
        if ($date !== '' && ($date < '2000-01-01' || $date > $today)) $date = '';

        $suggestion = ['kind' => $kind, 'amount' => $amount, 'entry_date' => $date, 'reference' => $reference,
            'receipt_type' => $kind === 'repayment' || $repayment ? $receiptType : ''];
        $sources = [];
        foreach ($suggestion as $field => $value) {
            if ($value !== '') $sources[$field] = $field === 'entry_date' && ! $dates ? $messageDateSource : 'message';
        }
        $required = ['kind', 'amount', 'entry_date'];
        if ($kind === 'repayment') $required = array_merge($required, ['reference', 'receipt_type']);
        return ['suggestion' => $suggestion, 'sources' => $sources,
            'missing_fields' => array_values(array_filter($required, fn ($field) => $suggestion[$field] === ''))];
    }

    private static function money(string $raw): string
    {
        $raw = rtrim($raw, '.');
        if (! preg_match('/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]{1,2})?$/D', $raw)) return '';
        [$whole, $fraction] = array_pad(explode('.', str_replace(',', '', $raw), 2), 2, '');
        if (strlen($whole) > 10 || ((int) $whole === 0 && (int) $fraction === 0)) return '';
        return ((string) (int) $whole).'.'.str_pad($fraction, 2, '0');
    }

    private static function date(string $raw): string
    {
        $parts = preg_split('/[-\/]/', $raw);
        [$year, $month, $day] = strlen($parts[0]) === 4 ? $parts : [$parts[2], $parts[1], $parts[0]];
        if (! checkdate((int) $month, (int) $day, (int) $year)) return '';
        return sprintf('%04d-%02d-%02d', $year, $month, $day);
    }
}
