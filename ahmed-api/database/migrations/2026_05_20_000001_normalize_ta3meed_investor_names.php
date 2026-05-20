<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $displayNames = [
        'ahmed' => 'أحمد',
        'sara' => 'سارة',
        'amal' => 'آمال',
        'mother' => 'أمي',
        'father' => 'الوالد',
        'building' => 'المبنى',
    ];

    private array $aliases = [
        'ahmed' => 'ahmed',
        'احمد' => 'ahmed',
        'sara' => 'sara',
        'ساره' => 'sara',
        'سارا' => 'sara',
        'amal' => 'amal',
        'امال' => 'amal',
        'امل' => 'amal',
        'mother' => 'mother',
        'mom' => 'mother',
        'امي' => 'mother',
        'امى' => 'mother',
        'الام' => 'mother',
        'والدتي' => 'mother',
        'father' => 'father',
        'dad' => 'father',
        'الوالد' => 'father',
        'والدي' => 'father',
        'ابوي' => 'father',
        'ابي' => 'father',
        'building' => 'building',
        'المبنى' => 'building',
        'المبني' => 'building',
    ];

    public function up(): void
    {
        if (! Schema::hasTable('investment_investors')) {
            return;
        }

        DB::transaction(function () {
            $hasUserId = Schema::hasColumn('investment_investors', 'user_id');
            $investors = DB::table('investment_investors')->orderBy('id')->get();
            $groups = [];

            foreach ($investors as $investor) {
                $canonicalCode = $this->code((string) ($investor->code ?: $investor->name));
                $userKey = $hasUserId ? (string) ($investor->user_id ?? 0) : 'global';
                $groups[$userKey . ':' . $canonicalCode][] = $investor;
            }

            foreach ($groups as $rows) {
                if (! count($rows)) {
                    continue;
                }

                $canonicalCode = $this->code((string) ($rows[0]->code ?: $rows[0]->name));
                $canonicalName = $this->displayName((string) $rows[0]->name, $canonicalCode);
                $keeper = collect($rows)->first(fn ($row) => $this->code((string) $row->code) === $canonicalCode) ?: $rows[0];
                $duplicateIds = collect($rows)->pluck('id')->filter(fn ($id) => (int) $id !== (int) $keeper->id)->values()->all();

                foreach ($duplicateIds as $duplicateId) {
                    $this->moveInvestorReferences((int) $duplicateId, (int) $keeper->id);
                }

                if (count($duplicateIds)) {
                    DB::table('investment_investors')->whereIn('id', $duplicateIds)->delete();
                }

                $update = [
                    'code' => $canonicalCode,
                    'name' => $canonicalName,
                ];

                if (Schema::hasColumn('investment_investors', 'updated_at')) {
                    $update['updated_at'] = now();
                }

                DB::table('investment_investors')->where('id', $keeper->id)->update($update);
            }
        });
    }

    public function down(): void
    {
        // لا يمكن استرجاع الأسماء المكررة بعد دمجها بأمان.
    }

    private function moveInvestorReferences(int $fromId, int $toId): void
    {
        $tables = [
            'investment_opportunity_allocations',
            'ta3meed_receipt_allocations',
            'ta3meed_investor_account_entries',
        ];

        foreach ($tables as $table) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'investor_id')) {
                continue;
            }

            $update = ['investor_id' => $toId];
            if (Schema::hasColumn($table, 'updated_at')) {
                $update['updated_at'] = now();
            }

            DB::table($table)->where('investor_id', $fromId)->update($update);
        }
    }

    private function code(string $value): string
    {
        $key = $this->key($value);

        return $this->aliases[$key] ?? ($key !== '' ? $key : 'investor');
    }

    private function displayName(string $value, string $code): string
    {
        return $this->displayNames[$code] ?? (trim($value) !== '' ? trim($value) : $code);
    }

    private function key(string $value): string
    {
        $value = mb_strtolower(trim($value), 'UTF-8');
        $value = str_replace(["\u{200f}", "\u{200e}", "\u{00a0}", 'ـ'], ['', '', ' ', ''], $value);
        $value = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $value) ?: $value;
        $value = str_replace(['أ', 'إ', 'آ', 'ٱ'], 'ا', $value);
        $value = str_replace(['ة', 'ى'], ['ه', 'ي'], $value);
        $value = preg_replace('/[^\p{L}\p{N}]+/u', '', $value) ?: $value;

        return trim($value);
    }
};
