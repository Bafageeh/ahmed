<?php

namespace App\Support;

use App\Http\Controllers\Api\Ta3meedReceiptController;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class Ta3meedSmsProcessor
{
    public function process(object $message, string $body): void
    {
        $parsed = Ta3meedSmsParser::parse($body);
        $values = ['analysis_status' => $parsed['status'], 'analysis_reason' => $parsed['reason'],
            'payment_reference' => $parsed['reference_number'], 'payment_amount' => $parsed['amount'],
            'analyzed_at' => now(), 'updated_at' => now()];
        if ($parsed['status'] === 'ready') {
            $arrivalDate = CarbonImmutable::createFromTimestampMs((int) $message->received_at_ms, 'Asia/Riyadh')->toDateString();
            $sentAt = (int) ($message->sent_at_ms ?? 0);
            $messageDate = $sentAt >= 946684800000 && $sentAt <= (int) $message->received_at_ms + 600000
                ? CarbonImmutable::createFromTimestampMs($sentAt, 'Asia/Riyadh')->toDateString() : $arrivalDate;
            $paymentDate = $parsed['receipt_date'] ?? $messageDate;
            // The enclosing ingestion transaction holds the account row lock, across devices.
            $fingerprint = hash_hmac('sha256', $paymentDate.'|'.mb_strtolower(Ta3meedSmsParser::normalize($body)), (string) config('app.key'));
            $values['payment_fingerprint'] = $fingerprint;
            $previous = DB::table('sms_archive_messages')->where('user_id', $message->user_id)
                ->where('payment_fingerprint', $fingerprint)->where('analysis_status', 'applied')->first();
            if ($previous) {
                $values['analysis_status'] = 'duplicate';
                $values['analysis_reason'] = 'message_already_applied';
                $values['receipt_id'] = $previous->receipt_id;
            } else {
                if ($paymentDate > $arrivalDate || $paymentDate < '2000-01-01') {
                    $result = ['status' => 'needs_review', 'reason' => 'invalid_payment_date'];
                } else {
                    $result = app(Ta3meedReceiptController::class)->recordIncomingSms((int) $message->user_id, $parsed, $body, $paymentDate);
                }
                $values['analysis_status'] = $result['status'];
                $values['analysis_reason'] = $result['reason'] ?? null;
                $values['receipt_id'] = $result['receipt_id'] ?? null;
            }
        }
        DB::table('sms_archive_messages')->where('id', $message->id)->update($values);
    }

    public static function outcome(object $message): array
    {
        $status = $message->analysis_status;
        $reference = $message->payment_reference;
        $amount = $message->payment_amount === null ? null : number_format((float) $message->payment_amount, 2, '.', ',');
        return ['message_id' => $message->id, 'client_id' => $message->client_id, 'status' => $status,
            'reason' => $message->analysis_reason, 'reference_number' => $reference,
            'amount' => $message->payment_amount, 'receipt_id' => $message->receipt_id,
            'notification' => $status === 'applied' ? [
                'title' => 'تم تسجيل سداد تعميد', 'body' => 'تم تسجيل سداد '.$amount.' ر.س للفرصة '.$reference.' وتحديث حصص المستثمرين.',
            ] : ($status === 'needs_review' ? [
                'title' => 'رسالة تعميد تحتاج مراجعة', 'body' => 'حُفظت رسالة تعميد'.($reference ? ' للفرصة '.$reference : '').' وتحتاج مراجعتك لإكمال تسجيل السداد.',
            ] : null)];
    }
}
