<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Ta3meedImageImportController extends Controller
{
    public function import(Request $request)
    {
        $data = $request->validate([
            'image_base64' => ['required', 'string'],
            'mime_type' => ['nullable', 'string'],
        ]);

        $apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: getenv('OPENAI_API_KEY');
        if (! $apiKey) {
            return response()->json([
                'message' => 'OPENAI_API_KEY غير موجود في ملف .env، لا يمكن قراءة الصورة تلقائيًا.',
            ], 422);
        }

        $parsed = $this->extractByVision($data['image_base64'], $data['mime_type'] ?? 'image/jpeg');

        if (empty($parsed['reference_number'])) {
            return response()->json([
                'message' => 'لم يتم التعرف على رقم الفرصة من الصورة.',
                'data' => $parsed,
            ], 422);
        }

        $platform = DB::table('investment_platforms')->where('code', 'ta3meed')->first();
        if (! $platform) {
            return response()->json(['message' => 'Ta3meed platform not found'], 404);
        }

        $accountId = $this->accountId((int) $platform->id);
        $result = $this->upsertOpportunity($platform, $accountId, $parsed);

        return response()->json(['data' => $result]);
    }

    private function extractByVision(string $base64, string $mimeType): array
    {
        $base64 = preg_replace('/^data:image\/[a-zA-Z0-9.+-]+;base64,/', '', $base64);
        $imageUrl = 'data:' . $mimeType . ';base64,' . $base64;

        $payload = [
            'model' => config('services.openai.vision_model') ?: env('OPENAI_VISION_MODEL', 'gpt-4o-mini'),
            'response_format' => ['type' => 'json_object'],
            'messages' => [[
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'text',
                        'text' =>
                            "استخرج بيانات فرصة تعميد من الصورة بدقة. أعد JSON فقط بالمفاتيح التالية:\n" .
                            "reference_number: رقم الفرصة مثل ER-XHYI565\n" .
                            "company_name: اسم المنشأة إن وجد\n" .
                            "sector: النشاط/الوصف إن وجد\n" .
                            "principal_amount: قيمة الاستثمار رقم فقط\n" .
                            "expected_profit_amount: الربح المتوقع رقم فقط\n" .
                            "expected_rate: صافي العائد السنوي أو النسبة إن وجدت رقم فقط\n" .
                            "months: مدة التمويل بالشهور رقم فقط\n" .
                            "maturity_date: تاريخ الاستحقاق بصيغة YYYY-MM-DD إذا وجد، وإذا كان '-' اجعله null\n" .
                            "category: تصنيف A+ أو A أو B... إذا وجد\n" .
                            "notes: ملاحظات مختصرة من الصورة\n" .
                            "لا تخمن أي قيمة غير واضحة، اجعلها null. هذه لقطة شاشة تعميد؛ ركّز على بطاقة رقم الفرصة وقيمة استثمار وربح متوقع ومدة التمويل وصافي العائد السنوي."
                    ],
                    [
                        'type' => 'image_url',
                        'image_url' => [
                            'url' => $imageUrl,
                            'detail' => 'high',
                        ],
                    ],
                ],
            ]],
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . (config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: getenv('OPENAI_API_KEY')),
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 90,
        ]);

        $raw = curl_exec($ch);
        $error = curl_error($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($raw === false || $status >= 400) {
            return [
                'reference_number' => null,
                'error' => $error ?: $raw,
                'status' => $status,
            ];
        }

        $json = json_decode($raw, true);
        $content = $json['choices'][0]['message']['content'] ?? '{}';
        $parsed = json_decode($content, true);

        if (! is_array($parsed)) {
            $parsed = [];
        }

        if (empty($parsed['reference_number']) && preg_match('/\\b[A-Z]{2,}-[A-Z0-9]{4,}\\b/u', $content, $m)) {
            $parsed['reference_number'] = $m[0];
        }

        return $this->normalizeParsed($parsed);
    }

    private function normalizeParsed(array $row): array
    {
        return [
            'reference_number' => $this->text($row['reference_number'] ?? null),
            'company_name' => $this->text($row['company_name'] ?? null),
            'sector' => $this->text($row['sector'] ?? null),
            'principal_amount' => $this->numberOrNull($row['principal_amount'] ?? null),
            'expected_profit_amount' => $this->numberOrNull($row['expected_profit_amount'] ?? null),
            'expected_rate' => $this->numberOrNull($row['expected_rate'] ?? null),
            'months' => $this->integerOrNull($row['months'] ?? null),
            'maturity_date' => $this->dateOrNull($row['maturity_date'] ?? null),
            'category' => $this->text($row['category'] ?? null),
            'notes' => $this->text($row['notes'] ?? null),
        ];
    }

    private function upsertOpportunity($platform, int $accountId, array $row): array
    {
        $code = trim($row['reference_number']);
        $existing = DB::table('investment_opportunities')
            ->where('platform_id', $platform->id)
            ->where('reference_number', $code)
            ->first();

        $oldMeta = $existing ? $this->decodeMeta($existing->metadata ?? null) : [];
        $meta = $oldMeta;

        foreach (['category', 'months', 'company_name', 'sector'] as $key) {
            if ($row[$key] !== null && $row[$key] !== '') {
                $meta[$key] = $row[$key];
            }
        }

        $meta['source'] = 'ta3meed_image_import';
        $meta['last_image_imported_at'] = now()->toDateTimeString();

        $payload = [
            'account_id' => $accountId,
            'platform_id' => $platform->id,
            'investment_type' => 'ta3meed',
            'reference_number' => $code,
            'title' => 'تعميد - ' . $code,
            'metadata' => json_encode($meta, JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ];

        if ($row['principal_amount'] !== null) $payload['principal_amount'] = $row['principal_amount'];
        if ($row['expected_profit_amount'] !== null) $payload['expected_profit_amount'] = $row['expected_profit_amount'];
        if ($row['expected_rate'] !== null) $payload['expected_rate'] = $row['expected_rate'];
        if ($row['maturity_date'] !== null) $payload['maturity_date'] = $row['maturity_date'];
        if ($row['notes'] !== null) $payload['notes'] = $row['notes'];
        if (Schema::hasColumn('investment_opportunities', 'profit_distribution')) $payload['profit_distribution'] = 'at_maturity';

        if ($existing) {
            DB::table('investment_opportunities')->where('id', $existing->id)->update($payload);
            $id = (int) $existing->id;
            $action = 'updated';
        } else {
            $payload['status'] = 'active';
            $payload['start_date'] = null;
            $payload['principal_amount'] = $payload['principal_amount'] ?? 0;
            $payload['expected_profit_amount'] = $payload['expected_profit_amount'] ?? 0;
            $payload['expected_rate'] = $payload['expected_rate'] ?? null;
            $payload['maturity_date'] = $payload['maturity_date'] ?? null;
            $payload['created_at'] = now();

            $id = DB::table('investment_opportunities')->insertGetId($payload);
            $action = 'created';
        }

        return [
            'action' => $action,
            'parsed' => $row,
            'investment' => DB::table('investment_opportunities')->where('id', $id)->first(),
        ];
    }

    private function accountId(int $platformId): int
    {
        $id = DB::table('investment_accounts')->where('platform_id', $platformId)->value('id');
        if ($id) return (int) $id;

        $payload = [
            'platform_id' => $platformId,
            'currency' => 'SAR',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('investment_accounts', 'display_name')) $payload['display_name'] = 'محفظة تعميد';
        if (Schema::hasColumn('investment_accounts', 'wallet_balance')) $payload['wallet_balance'] = 0;
        if (Schema::hasColumn('investment_accounts', 'total_invested_snapshot')) $payload['total_invested_snapshot'] = 0;
        if (Schema::hasColumn('investment_accounts', 'is_active')) $payload['is_active'] = true;

        return DB::table('investment_accounts')->insertGetId($payload);
    }

    private function decodeMeta(?string $metadata): array
    {
        if (! $metadata) return [];
        $decoded = json_decode($metadata, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function text($value): ?string
    {
        if ($value === null) return null;
        $text = trim((string) $value);
        return $text === '' || $text === '-' ? null : $text;
    }

    private function numberOrNull($value): ?float
    {
        if ($value === null || $value === '') return null;
        $clean = str_replace([',', 'ر.س', 'ريال', '%', ' '], '', (string) $value);
        return is_numeric($clean) ? round((float) $clean, 2) : null;
    }

    private function integerOrNull($value): ?int
    {
        $number = $this->numberOrNull($value);
        return $number === null ? null : (int) round($number);
    }

    private function dateOrNull($value): ?string
    {
        $text = $this->text($value);
        if (! $text) return null;
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $text)) return $text;
        if (preg_match('/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/', $text, $m)) {
            return sprintf('%04d-%02d-%02d', (int) $m[3], (int) $m[2], (int) $m[1]);
        }
        return null;
    }
}
