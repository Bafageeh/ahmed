<?php

namespace App\Support;

use App\Http\Controllers\Api\Ta3meedReceiptController;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class Ta3meedSmsProcessor
{
    public function process(object $message, string $body): void
    {
        if (Ta3meedInvestmentSmsParser::recognizes($body)) {
            $facts = Ta3meedInvestmentSmsParser::suggestion($message, $body);
            DB::table('sms_archive_messages')->where('id', $message->id)->update([
                'analysis_status' => 'needs_review', 'analysis_reason' => 'investment_requires_completion', 'action_type' => 'investment',
                'payment_reference' => $facts['code'] ?: null, 'payment_amount' => $facts['total_amount'] !== '' ? $facts['total_amount'] : null,
                'analyzed_at' => now(), 'updated_at' => now(),
            ]);
            return;
        }
        $wallet = Ta3meedWalletSmsParser::parse($body);
        if ($wallet['status'] !== 'not_wallet') {
            $this->processWallet($message, $body, $wallet);
            return;
        }
        $parsed = Ta3meedSmsParser::parse($body);
        $values = ['analysis_status' => $parsed['status'], 'analysis_reason' => $parsed['reason'],
            'payment_reference' => $parsed['reference_number'], 'payment_amount' => $parsed['amount'],
            'action_type' => 'repayment', 'analyzed_at' => now(), 'updated_at' => now()];
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
                } elseif (Ta3meedWalletLedger::possibleReceiptCreditOverlap((int) $message->user_id, (int) round($parsed['amount'] * 100), $paymentDate)) {
                    $result = ['status' => 'needs_review', 'reason' => 'possible_duplicate_wallet_transfer'];
                } else {
                    $result = app(Ta3meedReceiptController::class)->recordIncomingSms((int) $message->user_id, $parsed, $body, $paymentDate);
                }
                $values['analysis_status'] = $result['status'];
                $values['analysis_reason'] = $result['reason'] ?? null;
                $values['receipt_id'] = $result['receipt_id'] ?? null;
            }
        }
        if (! empty($values['receipt_id'])) {
            $values['wallet_entry_id'] = DB::table('ta3meed_wallet_entries')->where('user_id', $message->user_id)->where('receipt_id', $values['receipt_id'])->value('id');
        }
        DB::table('sms_archive_messages')->where('id', $message->id)->update($values);
    }

    private function processWallet(object $message, string $body, array $parsed): void
    {
        $values = ['analysis_status' => $parsed['status'], 'analysis_reason' => $parsed['reason'],
            'action_type' => $parsed['kind'] ?? 'wallet', 'payment_reference' => $parsed['transaction_reference'],
            'payment_amount' => $parsed['amount_cents'] === null ? null : $parsed['amount_cents'] / 100,
            'analyzed_at' => now(), 'updated_at' => now()];
        if ($parsed['status'] === 'ready') {
            $arrival = CarbonImmutable::createFromTimestampMs((int) $message->received_at_ms, 'Asia/Riyadh')->toDateString();
            $sent = (int) ($message->sent_at_ms ?? 0);
            $date = $parsed['entry_date'] ?? ($sent >= 946684800000 && $sent <= (int) $message->received_at_ms + 600000
                ? CarbonImmutable::createFromTimestampMs($sent, 'Asia/Riyadh')->toDateString() : $arrival);
            $result = $date > $arrival || $date < '2000-01-01'
                ? ['status' => 'needs_review', 'reason' => 'invalid_payment_date']
                : Ta3meedWalletLedger::applySms($message, $parsed, $date, $body);
            $values['analysis_status'] = $result['status'];
            $values['analysis_reason'] = $result['reason'] ?? null;
            $values['wallet_entry_id'] = $result['wallet_entry_id'] ?? null;
        }
        DB::table('sms_archive_messages')->where('id', $message->id)->update($values);
    }

    public static function outcome(object $message): array
    {
        $status = $message->analysis_status;
        $reference = $message->payment_reference;
        $amount = $message->payment_amount === null ? null : number_format((float) $message->payment_amount, 2, '.', ',');
        $action = $message->action_type ?? 'repayment';
        $wallet = in_array($action, ['deposit', 'withdrawal'], true);
        $walletLabel = $action === 'withdrawal' ? 'سحب' : 'إيداع';
        if ($action === 'investment') {
            return ['message_id' => $message->id, 'client_id' => $message->client_id, 'status' => $status, 'action_type' => $action,
                'reason' => $message->analysis_reason, 'reference_number' => $reference, 'amount' => $message->payment_amount,
                'receipt_id' => null, 'wallet_entry_id' => $message->wallet_entry_id ?? null, 'opportunity_id' => $message->investment_opportunity_id ?? null,
                'notification' => $status === 'needs_review' ? ['title' => 'قبول استثمار يحتاج إكمالًا',
                    'body' => 'افتح رسالة تعميد لإكمال بيانات الفرصة أو إلغائها. لم تُسجل فرصة أو حركة مالية.'] : null];
        }
        return ['message_id' => $message->id, 'client_id' => $message->client_id, 'status' => $status,
            'action_type' => $action, 'wallet_entry_id' => $message->wallet_entry_id ?? null,
            'reason' => $message->analysis_reason, 'reference_number' => $reference,
            'amount' => $message->payment_amount, 'receipt_id' => $message->receipt_id,
            'notification' => $status === 'applied' ? [
                'title' => $wallet ? 'تم تسجيل '.$walletLabel.' في محفظة تعميد' : 'تم تسجيل سداد تعميد',
                'body' => $wallet ? 'تم تسجيل '.$walletLabel.' بقيمة '.$amount.' ر.س وتحديث رصيد محفظة تعميد.'
                    : 'تم تسجيل سداد '.$amount.' ر.س للفرصة '.$reference.' وتحديث حصص المستثمرين ومحفظة تعميد.',
            ] : ($status === 'needs_review' ? [
                'title' => 'رسالة تعميد تحتاج مراجعة', 'body' => 'حُفظت رسالة تعميد'.($reference ? ($action === 'repayment' ? ' للفرصة ' : ' بمرجع ').$reference : '').' وتحتاج مراجعتك لإكمال تسجيل الحركة.',
            ] : null)];
    }
}
