<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;

final class Ta3meedInvestmentSmsParser
{
    public static function recognizes(string $body): bool
    {
        $text = Ta3meedSmsParser::normalize($body);
        if (preg_match('/لم\s+(?:يتم|يكتمل)\s+(?:قبول|ت[اأ]كيد)|(?:رفض|تعذر|عدم)\s+قبول|تم\s+(?:إلغاء|الغاء)\s+استثمارك/u', $text)) return false;
        // Instructions allowing cancellation within 48 hours do not mean cancellation occurred.
        return (bool) preg_match('/(?:^|\s)تم\s+(?:قبول|ت[اأ]كيد)\s+استثمار(?:ك|كم)?/u', $text);
    }

    public static function suggestion(object $row, ?string $body = null): array
    {
        $body = $body ?? Crypt::decryptString($row->body);
        $sent = (int) ($row->sent_at_ms ?? 0);
        $useSent = $sent >= 946684800000 && $sent <= (int) $row->received_at_ms + 600000;
        $date = CarbonImmutable::createFromTimestampMs($useSent ? $sent : (int) $row->received_at_ms, 'Asia/Riyadh')->toDateString();
        $facts = Ta3meedSmsReviewData::extract($body, $date, $useSent ? 'sent_at' : 'received_at');
        return ['code' => $facts['suggestion']['reference'], 'total_amount' => $facts['suggestion']['amount'],
            'start_date' => $facts['suggestion']['entry_date'], 'date_source' => $facts['sources']['entry_date'] ?? null];
    }

    /** Classify an already archived acceptance for review without rewriting its original SMS. */
    public static function forDisplay(object $row, string $body): object
    {
        if ($row->analysis_status === 'dismissed' || $row->analysis_status === 'investment_created'
            || $row->receipt_id || ($row->wallet_entry_id ?? null) || ! self::recognizes($body)
            || ! Ta3meedSmsParser::allowedSender(Crypt::decryptString($row->sender))) return $row;
        $copy = clone $row;
        $facts = self::suggestion($row, $body);
        $copy->analysis_status = 'needs_review'; $copy->analysis_reason = 'investment_requires_completion';
        $copy->action_type = 'investment'; $copy->payment_reference = $facts['code'] ?: null;
        $copy->payment_amount = $facts['total_amount'] !== '' ? $facts['total_amount'] : null;
        return $copy;
    }
}
