<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('investment_platforms') || ! Schema::hasTable('investment_opportunities')) {
            return;
        }

        $platformId = DB::table('investment_platforms')->where('code', 'moneymoon')->value('id');

        if (! $platformId) {
            return;
        }

        $investments = DB::table('investment_opportunities')
            ->where('platform_id', $platformId)
            ->where('investment_type', 'moneymoon')
            ->orderBy('id')
            ->get();

        $groups = [];

        foreach ($investments as $investment) {
            $metadata = $this->metadata($investment->metadata ?? null);
            $orderNo = $this->orderNumber($investment, $metadata);

            if (! $orderNo) {
                continue;
            }

            $groups[$orderNo][] = [
                'id' => (int) $investment->id,
                'status' => (string) ($investment->status ?? ''),
                'image_sequence' => isset($metadata['image_sequence']) ? (int) $metadata['image_sequence'] : PHP_INT_MAX,
            ];
        }

        foreach ($groups as $orderNo => $records) {
            if (count($records) <= 1) {
                continue;
            }

            usort($records, function (array $a, array $b): int {
                $aReceived = in_array($a['status'], ['received', 'completed'], true) ? 0 : 1;
                $bReceived = in_array($b['status'], ['received', 'completed'], true) ? 0 : 1;

                return [$aReceived, $a['image_sequence'], $a['id']] <=> [$bReceived, $b['image_sequence'], $b['id']];
            });

            $keepId = $records[0]['id'];
            $deleteIds = collect($records)
                ->pluck('id')
                ->reject(fn (int $id) => $id === $keepId)
                ->values()
                ->all();

            if (! empty($deleteIds)) {
                DB::table('investment_opportunities')
                    ->where('platform_id', $platformId)
                    ->whereIn('id', $deleteIds)
                    ->delete();
            }
        }
    }

    public function down(): void
    {
        // لا يمكن استرجاع السجلات المكررة بعد حذفها بأمان.
    }

    private function metadata($value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function orderNumber(object $investment, array $metadata): string
    {
        foreach (['external_order_no', 'order_no', 'order_number'] as $key) {
            if (! empty($metadata[$key])) {
                return trim((string) $metadata[$key]);
            }
        }

        foreach ([$investment->title ?? '', $investment->notes ?? ''] as $value) {
            if (preg_match('/L-[A-Za-z0-9-]+/', (string) $value, $matches)) {
                return trim($matches[0]);
            }
        }

        return '';
    }
};
