<?php

namespace App\Support;

final class Ta3meedActualProfit
{
    public static function apply(object $item): void
    {
        $item->actual_profit_amount = self::amount($item);
        $completed = $item->actual_profit_amount !== null;
        foreach (($item->allocations ?? []) as $allocation) {
            $received = (float) ($allocation->received_amount ?? 0);
            $actual = (float) ($allocation->actual_profit_amount ?? 0);
            // An unmatched historical receipt is unknown, rather than a total loss.
            $allocation->actual_profit_amount = $completed && ($received != 0 || $actual != 0)
                ? round($actual, 2)
                : null;
        }

        $receipts = [];
        foreach (($item->receipts ?? []) as $receipt) $receipts[] = $receipt;
        if (! $receipts) return;
        $receivedCents = 0;
        foreach ($receipts as $receipt) $receivedCents += self::cents($receipt->amount ?? 0);
        $expectedCents = self::cents($item->principal_amount ?? 0) + self::cents($item->expected_profit_amount ?? 0);
        $difference = $completed ? ($receivedCents - $expectedCents) / 100 : 0;
        $meta = json_decode((string) ($item->metadata ?? ''), true);
        if (! is_array($meta)) $meta = [];
        $meta['ta3meed_received_total'] = $receivedCents / 100;
        $meta['ta3meed_expected_total'] = $expectedCents / 100;
        $meta['ta3meed_remaining_amount'] = $completed ? 0 : max(0, ($expectedCents - $receivedCents) / 100);
        $meta['ta3meed_settlement_difference'] = $difference;
        $meta['ta3meed_settlement_note'] = $difference < 0 ? 'تسوية مبكرة أقل من المتوقع' : ($difference > 0 ? 'تسوية أعلى من المتوقع' : null);
        $item->metadata = json_encode($meta, JSON_UNESCAPED_UNICODE);
    }

    public static function amount(object $item): ?float
    {
        $status = strtolower(trim((string) ($item->status ?? '')));
        if (! in_array($status, ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done'], true)) {
            return null;
        }

        $receivedCents = 0;
        $hasReceipts = false;
        foreach (($item->receipts ?? []) as $receipt) {
            $hasReceipts = true;
            $receivedCents += self::cents($receipt->amount ?? 0);
        }

        // The receipt ledger takes precedence over allocation snapshots.
        if ($hasReceipts) {
            return ($receivedCents - self::cents($item->principal_amount ?? 0)) / 100;
        }

        foreach (($item->allocations ?? []) as $allocation) {
            $receivedCents += self::cents($allocation->received_amount ?? 0);
        }
        if ($receivedCents > 0) {
            return ($receivedCents - self::cents($item->principal_amount ?? 0)) / 100;
        }

        $metadata = json_decode((string) ($item->metadata ?? ''), true);
        $receivedCents = self::cents($metadata['ta3meed_received_total'] ?? 0);
        if ($receivedCents > 0) {
            return ($receivedCents - self::cents($item->principal_amount ?? 0)) / 100;
        }

        // Legacy completed imports can have a saved profit without a receipt ledger.
        return round((float) ($item->actual_profit_amount ?? 0), 2);
    }

    private static function cents($amount): int
    {
        return (int) round((float) $amount * 100);
    }
}
