<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BankStatementScheduleController extends Controller
{
    private const BANKS = [
        ['key' => 'snb', 'name' => 'البنك الأهلي السعودي', 'aliases' => ['الأهلي', 'الاهلي', 'الأهلي السعودي', 'الاهلي السعودي', 'البنك الأهلي', 'البنك الاهلي', 'SNB']],
        ['key' => 'alrajhi', 'name' => 'مصرف الراجحي', 'aliases' => ['الراجحي', 'مصرف الراجحي']],
        ['key' => 'riyad', 'name' => 'بنك الرياض', 'aliases' => ['الرياض', 'بنك الرياض']],
        ['key' => 'sab', 'name' => 'البنك السعودي الأول', 'aliases' => ['السعودي الأول', 'السعودي الاول', 'الأول', 'الاول', 'ساب', 'SAB', 'SABB']],
        ['key' => 'anb', 'name' => 'البنك العربي الوطني', 'aliases' => ['العربي', 'العربي الوطني', 'البنك العربي الوطني', 'ANB']],
        ['key' => 'alinma', 'name' => 'مصرف الإنماء', 'aliases' => ['الإنماء', 'الانماء', 'مصرف الإنماء', 'مصرف الانماء']],
        ['key' => 'bsf', 'name' => 'البنك السعودي الفرنسي', 'aliases' => ['الفرنسي', 'السعودي الفرنسي', 'البنك السعودي الفرنسي', 'BSF']],
        ['key' => 'saib', 'name' => 'البنك السعودي للاستثمار', 'aliases' => ['الاستثمار', 'السعودي للاستثمار', 'البنك السعودي للاستثمار', 'SAIB']],
        ['key' => 'aljazira', 'name' => 'بنك الجزيرة', 'aliases' => ['الجزيرة', 'بنك الجزيرة']],
        ['key' => 'albilad', 'name' => 'بنك البلاد', 'aliases' => ['البلاد', 'بنك البلاد']],
        ['key' => 'gib', 'name' => 'بنك الخليج الدولي - السعودية', 'aliases' => ['الخليج الدولي', 'بنك الخليج الدولي', 'GIB']],
        ['key' => 'stc', 'name' => 'STC Bank', 'aliases' => ['STC', 'STC Bank', 'اس تي سي بنك']],
        ['key' => 'vision', 'name' => 'Vision Bank', 'aliases' => ['Vision', 'Vision Bank', 'فيجن بنك']],
        ['key' => 'd360', 'name' => 'D360 Bank', 'aliases' => ['D360', 'D360 Bank', 'دي 360']],
    ];

    public function index()
    {
        return response()->json(['data' => $this->allSchedules()]);
    }

    public function mine(Request $request)
    {
        $userId = $this->userId($request);
        if (! $userId) {
            return response()->json(['data' => []]);
        }

        $bankTitles = DB::table('secure_vault_items')
            ->where('user_id', $userId)
            ->where('category', 'banks')
            ->pluck('title')
            ->filter()
            ->values()
            ->all();

        if (! count($bankTitles)) {
            return response()->json(['data' => []]);
        }

        $ownedKeys = [];
        foreach (self::BANKS as $bank) {
            foreach ($bankTitles as $title) {
                if ($this->matchesBank((string) $title, $bank)) {
                    $ownedKeys[$bank['key']] = true;
                    break;
                }
            }
        }

        $data = array_values(array_filter(
            $this->allSchedules(),
            fn (array $row) => isset($ownedKeys[$row['bank_key']]) && ! empty($row['statement_day'])
        ));

        return response()->json(['data' => $data]);
    }

    public function update(Request $request)
    {
        $keys = array_column(self::BANKS, 'key');
        $data = $request->validate([
            'schedules' => ['required', 'array'],
            'schedules.*.bank_key' => ['required', 'string', Rule::in($keys)],
            'schedules.*.statement_day' => ['nullable', 'integer', 'between:1,31'],
        ]);

        DB::transaction(function () use ($data) {
            foreach ($data['schedules'] as $item) {
                $bank = $this->bankByKey((string) $item['bank_key']);
                if (! $bank) {
                    continue;
                }

                DB::table('bank_statement_schedules')->updateOrInsert(
                    ['bank_key' => $bank['key']],
                    [
                        'bank_name' => $bank['name'],
                        'statement_day' => $item['statement_day'] ?? null,
                        'updated_at' => now(),
                    ]
                );
            }
        });

        return response()->json([
            'data' => $this->allSchedules(),
            'message' => 'تم حفظ مواعيد كشف البطاقات.',
        ]);
    }

    private function allSchedules(): array
    {
        $rows = DB::table('bank_statement_schedules')->get()->keyBy('bank_key');

        return array_map(function (array $bank) use ($rows) {
            $row = $rows->get($bank['key']);
            return [
                'bank_key' => $bank['key'],
                'bank_name' => $bank['name'],
                'statement_day' => $row && $row->statement_day ? (int) $row->statement_day : null,
            ];
        }, self::BANKS);
    }

    private function bankByKey(string $key): ?array
    {
        foreach (self::BANKS as $bank) {
            if ($bank['key'] === $key) {
                return $bank;
            }
        }
        return null;
    }

    private function matchesBank(string $title, array $bank): bool
    {
        $needle = $this->normalize($title);
        if ($needle === '') {
            return false;
        }

        $names = array_merge([$bank['name']], $bank['aliases'] ?? []);
        foreach ($names as $name) {
            $candidate = $this->normalize((string) $name);
            if ($candidate !== '' && ($needle === $candidate || str_contains($needle, $candidate) || str_contains($candidate, $needle))) {
                return true;
            }
        }
        return false;
    }

    private function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value), 'UTF-8');
        $value = str_replace(['أ', 'إ', 'آ', 'ى', 'ة', 'ـ'], ['ا', 'ا', 'ا', 'ي', 'ه', ''], $value);
        $value = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $value) ?: $value;
        $value = preg_replace('/[^\p{L}\p{N}]+/u', '', $value) ?: '';
        return $value;
    }

    private function userId(Request $request): ?int
    {
        return $request->attributes->get('ahmed_user_id') ?: (int) $request->header('X-Ahmed-User-Id') ?: null;
    }
}
