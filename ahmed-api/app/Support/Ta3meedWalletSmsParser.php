<?php

namespace App\Support;

final class Ta3meedWalletSmsParser
{
    public static function parse(string $body): array
    {
        $text = Ta3meedSmsParser::normalize($body);
        $result = ['status' => 'not_wallet', 'reason' => null, 'kind' => null, 'amount_cents' => null, 'transaction_reference' => null, 'entry_date' => null];
        // Opportunity payments retain the existing receipt path, including review for ambiguity.
        if (preg_match('/\bINV\s*-?\s*[A-Z]|الفرص[ةه]|للفرص[ةه]|سداد|تسديد|repayment/iu', $text)) return $result;
        $walletContext = preg_match('/محفظ|حسابك|حسابكم|الحساب\s+الاستثماري|رصيدك|رصيدكم|wallet/iu', $text);
        if (preg_match('/بنكي|البنكي|البنك/u', $text) && ! preg_match('/محفظ|الحساب\s+الاستثماري|wallet/iu', $text)) $walletContext = false;
        $deposit = preg_match('/[إا]يداع|شحن|deposit|top[ -]?up/iu', $text);
        $withdrawal = preg_match('/سحب|خصم|withdraw|deduct/iu', $text);
        $bankTransfer = preg_match('/تحويل.+(?:[إا]لى|لحسابك|لحسابكم).{0,40}(?:البنك|بنكي|البنكي)/u', $text);
        if (! $walletContext || (! $deposit && ! $withdrawal && ! $bankTransfer)) return $result;
        $result['status'] = 'non_payment';
        $result['reason'] = 'wallet_transfer_not_completed';
        if (preg_match('/سيتم|سوف|لم\s+(?:يتم|تتم|يكتمل)|طلب|قيد\s+المعالجة|قيد\s+التنفيذ|فشل|تعذر|[إا]لغاء|رمز\s+التحقق|\bOTP\b|pending|failed|request/iu', $text)) return $result;
        if (! preg_match('/(?:تمت?|اكتملت?|نجحت?)\s+.{0,50}(?:[إا]يداع|شحن|سحب|خصم|تحويل)|(?:[إا]يداع|شحن|سحب|خصم|تحويل).{0,50}بنجاح|(?:deposit|withdrawal|top[ -]?up)\s+(?:completed|successful)/iu', $text)) {
            return array_replace($result, ['status' => 'needs_review', 'reason' => 'wallet_transfer_not_confirmed']);
        }
        $result['status'] = 'needs_review';
        $result['reason'] = 'ambiguous_wallet_direction';
        $withdrawal = $withdrawal || $bankTransfer;
        if ((bool) $deposit === (bool) $withdrawal) return $result;
        $result['kind'] = $deposit ? 'deposit' : 'withdrawal';
        preg_match_all('/(?:بقيمة|بمبلغ|مبلغ|قيمة(?:\s+العملية)?|amount(?:\s+of)?)\s*[:：=]?\s*([0-9][0-9,.]*)/iu', $text, $amounts);
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
        $result['amount_cents'] = $cents;
        if (preg_match('/(?:رسوم|ضريبة|fees?|VAT)\s*[:：]?\s*[0-9]/iu', $text)) return array_replace($result, ['reason' => 'wallet_fee_needs_review']);
        preg_match_all('/(?:رقم\s+(?:العملية|الحركة|الحوالة|المرجع)|الرقم\s+المرجعي|مرجع(?:\s+العملية)?|reference|\bref)\s*[:：#-]?\s*([A-Z0-9][A-Z0-9-]{2,99})/iu', $text, $refs);
        $refs = array_values(array_unique(array_map('strtoupper', $refs[1])));
        if (count($refs) > 1) return array_replace($result, ['reason' => 'ambiguous_wallet_reference']);
        $result['transaction_reference'] = $refs[0] ?? null;
        preg_match_all('/(?:بتاريخ|تاريخ\s+العملية|\bon)\s*[:：]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/iu', $text, $dates);
        if (count($dates[1]) > 1) return array_replace($result, ['reason' => 'ambiguous_payment_date']);
        if ($dates[1]) {
            $rawDate = $dates[1][0];
            $date = \DateTimeImmutable::createFromFormat(str_contains($rawDate, '/') ? '!d/m/Y' : '!Y-m-d', $rawDate);
            $errors = \DateTimeImmutable::getLastErrors();
            if (! $date || ($errors && ($errors['warning_count'] || $errors['error_count']))) return array_replace($result, ['reason' => 'invalid_payment_date']);
            $result['entry_date'] = $date->format('Y-m-d');
        }
        return array_replace($result, ['status' => 'ready', 'reason' => null]);
    }
}
