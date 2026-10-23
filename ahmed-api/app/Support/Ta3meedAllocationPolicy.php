<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class Ta3meedAllocationPolicy
{
    public static function cents($value, string $field = 'amount'): int
    {
        $text = trim((string) ($value ?? '0'));
        if (! preg_match('/^\d{1,10}(?:\.\d{1,2})?$/D', $text)) {
            self::fail($field, 'أدخل مبلغاً صحيحاً بمنزلتين عشريتين كحد أقصى.');
        }
        [$whole, $fraction] = array_pad(explode('.', $text, 2), 2, '');
        return ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');
    }

    public static function savedCents($value): int
    {
        return (int) round((float) $value * 100);
    }

    public static function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }

    public static function userId($request): int
    {
        $id = (int) ($request->attributes->get('ahmed_user_id') ?: $request->header('X-Ahmed-User-Id', 0));
        abort_unless($id > 0 && DB::table('users')->where('id', $id)->exists(), 403);
        return $id;
    }

    public static function resolve(array $rows, int $userId): array
    {
        $resolved = [];
        $seen = [];
        foreach ($rows as $index => $row) {
            $query = DB::table('investment_investors')->where('user_id', $userId);
            if (! empty($row['investor_id'])) {
                $investor = $query->where('id', (int) $row['investor_id'])->first();
            } else {
                // Compatibility with existing clients: resolve an existing name only.
                // A typed name must never create, merge, rename or reactivate an investor.
                $name = trim((string) ($row['investor'] ?? ''));
                $matches = $query->where(function ($q) use ($name) {
                    $q->where('name', $name)->orWhere('code', $name);
                })->get();
                $investor = $matches->count() === 1 ? $matches->first() : null;
            }
            if (! $investor) self::fail("allocations.$index.investor_id", 'اختر مستثمراً مسجلاً في حسابك من قائمة المستثمرين.');
            if (isset($seen[$investor->id])) self::fail('allocations', 'لا يمكن تكرار المستثمر نفسه في الفرصة.');
            $seen[$investor->id] = true;
            $amount = self::cents($row['amount'] ?? 0, "allocations.$index.amount");
            if ($amount <= 0) self::fail("allocations.$index.amount", 'مبلغ مشاركة المستثمر يجب أن يكون أكبر من صفر.');
            $resolved[] = [
                'allocation_id' => isset($row['allocation_id']) ? (int) $row['allocation_id'] : null,
                'investor_id' => (int) $investor->id,
                'name' => $investor->name,
                'active' => (bool) $investor->is_active,
                'cents' => $amount,
            ];
        }
        return $resolved;
    }

    public static function decorate(object $item): void
    {
        $allocations = collect($item->allocations ?? [])->sortBy('id')->values();
        $receipts = collect($item->receipts ?? [])->sortBy('id')->values();
        $closed = in_array(strtolower(trim((string) $item->status)), ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done', 'cancelled', 'canceled'], true);
        $item->allocations_locked = $closed || $receipts->isNotEmpty() || $allocations->contains(function ($a) {
            return self::savedCents($a->received_amount ?? 0) !== 0 || self::savedCents($a->actual_profit_amount ?? 0) !== 0;
        });
        $item->allocation_version = hash('sha256', json_encode([
            $item->id, $item->user_id ?? null, $item->status, $item->updated_at ?? null,
            self::savedCents($item->principal_amount), self::savedCents($item->expected_profit_amount),
            $allocations->map(fn ($a) => [$a->id, $a->investor_id ?? null, self::savedCents($a->invested_amount), self::savedCents($a->expected_profit_amount), self::savedCents($a->received_amount ?? 0), $a->status ?? null])->all(),
            $receipts->map(fn ($r) => [$r->id, self::savedCents($r->amount), $r->receipt_type, $r->receipt_date])->all(),
        ], JSON_UNESCAPED_UNICODE));
    }

    public static function load(object $investment, int $userId): object
    {
        $investment->allocations = DB::table('investment_opportunity_allocations')->where('opportunity_id', $investment->id)->where('user_id', $userId)->orderBy('id')->get();
        $investment->receipts = DB::table('ta3meed_receipts')->where('opportunity_id', $investment->id)->where('user_id', $userId)->orderBy('id')->get();
        self::decorate($investment);
        return $investment;
    }

    public static function checkVersion(object $item, ?string $version): void
    {
        if ($version !== null && ! hash_equals($item->allocation_version, $version)) {
            abort(409, 'تغيرت بيانات الفرصة أو دفعاتها أثناء التعديل. أعد فتحها لمراجعة أحدث البيانات.');
        }
    }

    public static function sync(object $investment, array $data, int $userId, bool $creating = false): void
    {
        $existing = $investment->allocations ?? collect();
        $total = self::cents($data['total_amount'], 'total_amount');
        $profit = self::cents($data['profit'] ?? 0, 'profit');
        $oldTotal = self::savedCents($investment->principal_amount);
        $oldProfit = self::savedCents($investment->expected_profit_amount);
        $rows = array_key_exists('allocations', $data)
            ? self::resolve($data['allocations'] ?? [], $userId)
            : $existing->map(fn ($a) => ['allocation_id' => $a->id, 'investor_id' => $a->investor_id, 'cents' => self::savedCents($a->invested_amount), 'active' => true])->all();

        $same = count($rows) === $existing->count();
        foreach ($rows as &$row) {
            $current = $row['allocation_id']
                ? $existing->firstWhere('id', $row['allocation_id'])
                : $existing->firstWhere('investor_id', $row['investor_id']);
            if ($row['allocation_id'] && ! $current) self::fail('allocations', 'تعذر التحقق من الحصة المحددة في هذه الفرصة. أعد تحميل البيانات.');
            if ($current && (int) $current->investor_id !== $row['investor_id']) self::fail('allocations', 'تغيير صاحب الحصة يتم من إجراء تصحيح المستثمر أو نقل الحصة.');
            $row['current'] = $current;
            $same = $same && $current && self::savedCents($current->invested_amount) === $row['cents'];
            if (! $current && ! $row['active']) self::fail('allocations', 'هذا المستثمر موقوف عن المشاركات الجديدة.');
        }
        unset($row);
        $unchanged = ! $creating && $same && $total === $oldTotal && $profit === $oldProfit;
        if ($unchanged) return; // Preserve legacy cents, IDs, profits and receipt balances exactly.
        if (! $creating && $investment->allocations_locked) {
            self::fail('allocations', 'هذه الفرصة مرتبطة بحقوق أو دفعات مسجلة. لا يمكن تغيير مبالغها أو توزيعها من التعديل العادي. لتصحيح اسم صاحب الحصة استخدم إجراء تصحيح المستثمر.');
        }
        if (! $rows) self::fail('allocations', 'أضف مستثمراً واحداً على الأقل ووزع مبلغ الاستثمار كاملاً.');
        if (array_sum(array_column($rows, 'cents')) !== $total) self::fail('allocations', 'مجموع مشاركات المستثمرين يجب أن يساوي أصل الاستثمار تماماً.');

        $before = $existing->map(fn ($a) => (array) $a)->all();
        $profits = self::distribute($profit, array_column($rows, 'cents'), $total);
        $retained = [];
        foreach ($rows as $index => $row) {
            $current = $row['current'];
            $values = ['invested_amount' => $row['cents'] / 100, 'expected_profit_amount' => $profits[$index] / 100, 'updated_at' => now()];
            if ($current) {
                DB::table('investment_opportunity_allocations')->where('id', $current->id)->where('user_id', $userId)->update($values);
                $retained[] = $current->id;
            } else {
                $retained[] = DB::table('investment_opportunity_allocations')->insertGetId($values + [
                    'opportunity_id' => $investment->id, 'investor_id' => $row['investor_id'], 'user_id' => $userId,
                    'actual_profit_amount' => 0, 'received_amount' => 0, 'status' => $investment->status, 'created_at' => now(),
                ]);
            }
        }
        DB::table('investment_opportunity_allocations')->where('opportunity_id', $investment->id)->where('user_id', $userId)->whereNotIn('id', $retained)->delete();
        self::audit($userId, $creating ? 'allocations_created' : 'allocations_updated', null, $investment->id, null, $before,
            DB::table('investment_opportunity_allocations')->where('opportunity_id', $investment->id)->where('user_id', $userId)->orderBy('id')->get()->map(fn ($a) => (array) $a)->all());
    }

    public static function distribute(int $total, array $weights, int $denominator): array
    {
        $amounts = []; $remainders = [];
        foreach ($weights as $index => $weight) {
            [$amounts[$index], $remainders[$index]] = self::proportion($total, $weight, $denominator);
        }
        $left = $total - array_sum($amounts);
        $order = array_keys($weights);
        usort($order, fn ($a, $b) => $remainders[$b] <=> $remainders[$a] ?: $a <=> $b);
        for ($i = 0; $i < $left; $i++) $amounts[$order[$i]]++;
        return $amounts;
    }

    // Exact integer multiplication/division without overflowing a currency product.
    private static function proportion(int $total, int $weight, int $denominator): array
    {
        $whole = intdiv($total, $denominator) * $weight;
        $term = $total % $denominator; $termWhole = 0; $remainder = 0;
        while ($weight > 0) {
            if ($weight % 2 === 1) {
                $whole += $termWhole; $remainder += $term;
                if ($remainder >= $denominator) { $whole++; $remainder -= $denominator; }
            }
            $weight = intdiv($weight, 2);
            $term *= 2; $termWhole *= 2;
            if ($term >= $denominator) { $termWhole++; $term -= $denominator; }
        }
        return [$whole, $remainder];
    }

    public static function audit(int $userId, string $action, ?int $investorId, ?int $opportunityId, ?int $allocationId, $before, $after, ?string $reason = null): void
    {
        DB::table('ta3meed_investor_audits')->insert([
            'user_id' => $userId, 'actor_user_id' => $userId, 'action' => $action, 'investor_id' => $investorId,
            'opportunity_id' => $opportunityId, 'allocation_id' => $allocationId, 'reason' => $reason,
            'before_json' => json_encode($before, JSON_UNESCAPED_UNICODE), 'after_json' => json_encode($after, JSON_UNESCAPED_UNICODE), 'created_at' => now(),
        ]);
    }
}
