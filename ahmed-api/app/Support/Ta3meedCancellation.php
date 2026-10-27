<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class Ta3meedCancellation
{
    /** Only a confirmed cancellation, never an instruction or pending request. */
    public static function parse(string $body): array
    {
        $text = Ta3meedSmsParser::normalize($body);
        if (!preg_match('/تم\s+(?:إلغاء|الغاء)\s+استثمارك(?:م)?\s+في\s+الفرص[ةه]/u', $text)) {
            return ['status' => 'not_cancellation', 'reference' => null, 'reason' => null];
        }
        if (!preg_match('/\bبنجاح\b/u', $text)) {
            return ['status' => 'needs_review', 'reference' => null, 'reason' => 'cancellation_not_confirmed'];
        }
        preg_match_all('/\b(?:INV|ER)-[A-Z0-9]*[0-9][A-Z0-9]*\b/iu', strtoupper($text), $matches);
        $refs = array_values(array_unique($matches[0]));
        if (count($refs) !== 1) {
            return ['status' => 'needs_review', 'reference' => null, 'reason' => 'cancellation_reference_ambiguous'];
        }
        return ['status' => 'ready', 'reference' => $refs[0], 'reason' => null];
    }

    private static function referenceKey(string $reference): string
    {
        return mb_strtolower(preg_replace('/[-\s]+/u', '', trim($reference)));
    }

    /**
     * Must run within a DB transaction while the owner's users row is locked.
     * A stable cancellation reference deduplicates manual and SMS refunds, even
     * when multiple devices submit the same SMS.
     */
    public static function apply(int $userId, string $reference, ?int $messageId = null): array
    {
        abort_unless(DB::transactionLevel() > 0, 500, 'Cancellation requires a transaction.');
        $key = self::referenceKey($reference);
        $opportunities = DB::table('investment_opportunities as o')
            ->join('investment_platforms as p', 'p.id', '=', 'o.platform_id')
            ->where('o.user_id', $userId)->where('p.code', 'ta3meed')
            ->whereRaw("LOWER(REPLACE(REPLACE(o.reference_number, '-', ''), ' ', '')) = ?", [$key])
            ->select('o.*')->lockForUpdate()->limit(2)->get();
        if ($opportunities->count() !== 1) {
            return ['status' => 'needs_review', 'reason' => $opportunities->isEmpty() ? 'cancellation_opportunity_missing' : 'cancellation_ambiguous_opportunity'];
        }
        $op = $opportunities->first();
        $cents = Ta3meedAllocationPolicy::savedCents($op->principal_amount);
        if ($cents <= 0) return ['status' => 'needs_review', 'reason' => 'cancellation_invalid_amount', 'opportunity_id' => $op->id];
        $status = strtolower(trim((string) $op->status));
        if (in_array($status, ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done', 'partial_received'], true)
            || DB::table('ta3meed_receipts')->where('user_id', $userId)->where('opportunity_id', $op->id)->exists()) {
            return ['status' => 'needs_review', 'reason' => 'cancellation_has_receipts_or_completed', 'opportunity_id' => $op->id];
        }

        // Check for the refund before changing state. The same key survives an SMS replay.
        $existing = DB::table('ta3meed_wallet_entries')->where('user_id', $userId)->where('source', 'cancellation')
            ->whereRaw("LOWER(REPLACE(REPLACE(transaction_reference, '-', ''), ' ', '')) = ?", [$key])
            ->lockForUpdate()->first();
        if ($existing) {
            if ($existing->voided_at !== null || $existing->kind !== 'deposit' || (int)$existing->amount_cents !== $cents) {
                return ['status' => 'needs_review', 'reason' => 'cancellation_refund_conflict', 'opportunity_id' => $op->id];
            }
        }

        if ($status !== 'cancelled' && $status !== 'canceled') {
            DB::table('investment_opportunities')->where('id', $op->id)->where('user_id', $userId)
                ->update(['status' => 'cancelled', 'updated_at' => now()]);
            DB::table('investment_opportunity_allocations')->where('opportunity_id', $op->id)
                ->where('user_id', $userId)->whereNotIn('status', ['received', 'completed'])
                ->update(['status' => 'cancelled', 'updated_at' => now()]);
        }

        if ($existing) {
            return ['status' => 'duplicate', 'reason' => 'cancellation_refund_already_recorded',
                'opportunity_id' => $op->id, 'wallet_entry_id' => $existing->id, 'amount_cents' => $cents];
        }

        // The funding entry may already use investment_opportunity_id's unique constraint.
        // Reference + source + fingerprint uniquely identify the refund instead.
        $id = DB::table('ta3meed_wallet_entries')->insertGetId([
            'user_id' => $userId, 'kind' => 'deposit', 'amount_cents' => $cents,
            'entry_date' => now('Asia/Riyadh')->toDateString(), 'source' => 'cancellation',
            'sms_message_id' => $messageId,
            'transaction_reference' => $op->reference_number,
            'fingerprint' => hash_hmac('sha256', 'investment-cancellation|'.$userId.'|'.$key, (string)config('app.key')),
            'notes' => 'استرجاع رأس مال فرصة تعميد الملغاة '.$op->reference_number,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Ta3meedWalletLedger::audit($userId, $id, 'created');
        return ['status' => 'applied', 'reason' => null, 'opportunity_id' => $op->id,
            'wallet_entry_id' => $id, 'amount_cents' => $cents];
    }
}
