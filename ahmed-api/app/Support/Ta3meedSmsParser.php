<?php

namespace App\Support;

final class Ta3meedSmsParser
{
    public static function allowedSender(string $sender): bool
    {
        return strcasecmp(trim($sender), 'Ta3meed') === 0;
    }

    public static function normalize(string $text): string
    {
        $text = strtr($text, array_combine(
            preg_split('//u', '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', -1, PREG_SPLIT_NO_EMPTY),
            str_split('01234567890123456789')
        ));
        $text = str_replace(['٫', '٬', '–', '—'], ['.', ',', '-', '-'], $text);
        $text = preg_replace('/[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{0640}\x{064B}-\x{065F}]/u', '', $text);
        return trim(preg_replace('/\s+/u', ' ', $text));
    }

    public static function parse(string $body): array
    {
        $text = self::normalize($body);
        $result = ['status' => 'non_payment', 'reason' => 'not_a_payment', 'reference_number' => null, 'amount' => null, 'receipt_type' => 'partial', 'receipt_date' => null];
        if (preg_match('/(?:لم\s+(?:يتم|يكتمل)|سيتم|سوف|قريبا|قريبًا|موعد\s+السداد|طلب\s+(?:السداد|سداد)|(?:عدم|فشل|تعذر|إلغاء|الغاء)\s+(?:السداد|سداد)|رمز\s+التحقق|\bOTP\b|payment\s+(?:due|failed|request)|will\s+be\s+paid)/iu', $text)) return $result;
        $completed = preg_match('/(?:تم\s+(?:(?:بحمد\s+الله|بنجاح)\s+)?(?:سداد|تسديد|استلام|إستلام|ايداع|إيداع|استرداد)|استلمت|استلمتم|سداد\s+(?:جزئي|كلي|كامل)\s+(?:للفرصة|للفرصه|للاستثمار)|(?:payment|repayment)\s+(?:received|completed)|fully\s+repaid)/iu', $text);
        if (! $completed) {
            if (preg_match('/سداد|تسديد|repayment/iu', $text)) return array_replace($result, ['status' => 'needs_review', 'reason' => 'payment_not_confirmed']);
            return $result;
        }
        $result['status'] = 'needs_review';
        $result['reason'] = 'missing_or_ambiguous_reference';
        $upper = strtoupper($text);
        preg_match_all('/\bINV\s*-?\s*[A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*\b/u', $upper, $references);
        if (! $references[0]) {
            preg_match_all('/(?:للفرصة|للفرصه|الفرصة|الفرصه)\s*(?:رقم)?\s*([A-Z]{2,}[A-Z0-9-]*[0-9][A-Z0-9-]*)/u', $upper, $fallback);
            $references[0] = $fallback[1];
        }
        $refs = array_values(array_unique(array_map(fn ($ref) => preg_replace('/^INV(?=[A-Z0-9])/', 'INV-', preg_replace('/\s+/', '', $ref)), $references[0])));
        if (count($refs) !== 1) return $result;
        $result['reference_number'] = $refs[0];
        preg_match_all('/(?:بقيمة|بمبلغ|مبلغ(?:\s+السداد)?|القيمة(?:\s+المسددة)?|amount(?:\s+of)?)\s*[:：=]?\s*([0-9][0-9,.]*)/iu', $text, $amounts);
        if (! $amounts[1]) preg_match_all('/([0-9][0-9,.]*)\s*(?:ريال(?:\s+سعودي)?|ر\.س|SAR)\b/iu', $text, $amounts);
        $result['reason'] = 'missing_or_ambiguous_amount';
        if (count($amounts[1]) !== 1) return $result;
        $raw = rtrim($amounts[1][0], '.');
        if (! preg_match('/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]{1,2})?$/D', $raw)) return $result;
        $raw = str_replace(',', '', $raw);
        [$whole, $fraction] = array_pad(explode('.', $raw, 2), 2, '');
        if (strlen($whole) > 10) return $result;
        $cents = ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');
        if ($cents <= 0) return $result;
        $result['amount'] = $cents / 100;
        // A capital-and-profit installment must not prematurely close the investment.
        $partial = preg_match('/جزئي|جزء|دفعة|قسط|partial/iu', $text);
        $early = preg_match('/(?:تسوية|سداد)\s+مبكر|early\s+settlement/iu', $text);
        $full = preg_match('/سداد\s+(?:كلي|كامل)|بالكامل|fully\s+repaid|final\s+repayment/iu', $text)
            || (! $partial && preg_match('/ر[اأ]س\s+المال\s+و[اأإ]?ل?ارباح|ر[اأ]س\s+المال\s+والأرباح/u', $text));
        if ($partial && ($full || $early)) return array_replace($result, ['reason' => 'conflicting_payment_type']);
        $result['receipt_type'] = $early ? 'early_settlement' : ($full ? 'full' : 'partial');
        preg_match_all('/(?:بتاريخ|تاريخ\s+السداد|\bon)\s*[:：]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/iu', $text, $dates);
        if (count($dates[1]) > 1) return array_replace($result, ['reason' => 'ambiguous_payment_date']);
        if ($dates[1]) {
            $rawDate = $dates[1][0];
            $format = str_contains($rawDate, '/') ? '!d/m/Y' : '!Y-m-d';
            $date = \DateTimeImmutable::createFromFormat($format, $rawDate);
            $errors = \DateTimeImmutable::getLastErrors();
            if (! $date || ($errors && ($errors['warning_count'] || $errors['error_count']))) return array_replace($result, ['reason' => 'invalid_payment_date']);
            $result['receipt_date'] = $date->format('Y-m-d');
        }
        return array_replace($result, ['status' => 'ready', 'reason' => null]);
    }
}
