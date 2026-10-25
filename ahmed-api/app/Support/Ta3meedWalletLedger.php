<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class Ta3meedWalletLedger
{
    public const CATEGORIES = ['opening_balance', 'deposit', 'withdrawal', 'repayment'];

    public static function active(int $userId)
    {
        // Linked receipts remain authoritative when their dates change or they are deleted.
        return DB::table('ta3meed_wallet_entries as e')
            ->leftJoin('ta3meed_receipts as r', function ($join) {
                $join->on('r.id', '=', 'e.receipt_id')->on('r.user_id', '=', 'e.user_id');
            })->where('e.user_id', $userId)->whereNull('e.voided_at')
            ->where(fn ($q) => $q->whereNull('e.receipt_id')->orWhereNotNull('r.id'));
    }

    public static function amountSql(): string
    {
        return 'CASE WHEN e.receipt_id IS NULL THEN e.amount_cents ELSE ROUND(r.amount * 100) END';
    }

    public static function dateSql(): string
    {
        return 'COALESCE(r.receipt_date, e.entry_date)';
    }

    public static function summary(int $userId): array
    {
        $rows = self::active($userId)->select('e.kind')->selectRaw('SUM('.self::amountSql().') as total_cents')->selectRaw('COUNT(*) as quantity')->groupBy('e.kind')->get();
        $sums = array_fill_keys(self::CATEGORIES, 0);
        $count = 0;
        foreach ($rows as $row) { $sums[$row->kind] = (int) $row->total_cents; $count += (int) $row->quantity; }
        return ['balance_cents' => array_sum($sums), 'opening_cents' => $sums['opening_balance'], 'deposits_cents' => $sums['deposit'],
            'withdrawals_cents' => abs($sums['withdrawal']), 'repayments_cents' => $sums['repayment'], 'count' => $count,
            'has_opening_balance' => DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('kind', 'opening_balance')->whereNull('voided_at')->exists()];
    }

    public static function audit(int $userId, int $id, string $action): void
    {
        $entry = DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('id', $id)->first();
        DB::table('ta3meed_wallet_audits')->insert(['user_id' => $userId, 'entry_id' => $id, 'action' => $action,
            'snapshot' => json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'created_at' => now()]);
    }

    public static function recordReceipt(int $userId, int $receiptId): ?int
    {
        $existing = DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('receipt_id', $receiptId)->value('id');
        if ($existing) return (int) $existing;
        $receipt = DB::table('ta3meed_receipts')->where('user_id', $userId)->where('id', $receiptId)->first();
        if (! $receipt) return null;
        $id = DB::table('ta3meed_wallet_entries')->insertGetId(['user_id' => $userId, 'kind' => 'repayment',
            'amount_cents' => (int) round((float) $receipt->amount * 100), 'entry_date' => $receipt->receipt_date,
            'source' => 'receipt', 'receipt_id' => $receiptId, 'transaction_reference' => $receipt->reference_number,
            'notes' => 'سداد تعميد وارد', 'created_at' => now(), 'updated_at' => now()]);
        self::audit($userId, $id, 'created');
        return $id;
    }

    public static function possibleDuplicate(int $userId, int $cents, string $date, ?string $reference = null, ?int $excluding = null): ?object
    {
        $query = self::active($userId)->where('e.kind', '!=', 'opening_balance')->whereRaw('('.self::amountSql().') = ?', [$cents])->whereRaw(self::dateSql().' = ?', [$date]);
        if ($excluding) $query->where('e.id', '!=', $excluding);
        // Distinct explicit transfer references identify separate transfers of equal value.
        if ($reference) $query->where(fn ($q) => $q->whereNull('e.transaction_reference')->orWhere('e.transaction_reference', $reference));
        return $query->select('e.id', 'e.kind', 'e.source')->first();
    }

    public static function applySms(object $message, array $parsed, string $date, string $body): array
    {
        $userId = (int) $message->user_id;
        $signed = ($parsed['kind'] === 'withdrawal' ? -1 : 1) * $parsed['amount_cents'];
        $ref = $parsed['transaction_reference'];
        $fingerprint = hash_hmac('sha256', 'wallet|'.$parsed['kind'].'|'.($ref ? 'ref:'.$ref : $date.'|'.mb_strtolower(Ta3meedSmsParser::normalize($body))), (string) config('app.key'));
        $existing = DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('fingerprint', $fingerprint)->first();
        if ($existing) {
            // A reused operation reference with a conflicting amount must never be silently accepted.
            if ((int) $existing->amount_cents !== $signed) return ['status' => 'needs_review', 'reason' => 'wallet_reference_conflict'];
            return ['status' => 'duplicate', 'reason' => 'wallet_transfer_already_exists', 'wallet_entry_id' => $existing->id];
        }
        if (self::possibleDuplicate($userId, $signed, $date, $ref)) return ['status' => 'needs_review', 'reason' => 'possible_duplicate_wallet_transfer'];
        $id = DB::table('ta3meed_wallet_entries')->insertGetId(['user_id' => $userId, 'kind' => $parsed['kind'], 'amount_cents' => $signed,
            'entry_date' => $date, 'source' => 'sms', 'sms_message_id' => $message->id,
            'fingerprint' => $fingerprint, 'transaction_reference' => $ref, 'notes' => 'من رسالة Ta3meed',
            'created_at' => now(), 'updated_at' => now()]);
        self::audit($userId, $id, 'created');
        return ['status' => 'applied', 'wallet_entry_id' => $id];
    }
}
