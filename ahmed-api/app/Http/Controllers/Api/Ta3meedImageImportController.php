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
            'image_parts' => ['nullable', 'array'],
            'image_parts.*.base64' => ['required_with:image_parts', 'string'],
            'image_parts.*.mime_type' => ['nullable', 'string'],
            'image_parts.*.label' => ['nullable', 'string'],
            'manual_reference_number' => ['nullable', 'string', 'max:100'],
            'instructions' => ['nullable', 'string', 'max:1000'],
        ]);

        $apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: getenv('OPENAI_API_KEY');

        if (! $apiKey) {
            return response()->json([
                'message' => 'OPENAI_API_KEY غير موجود في ملف .env، لا يمكن قراءة الصورة تلقائيًا.',
            ], 422);
        }

        $parsed = $this->extractByVision(
            $data['image_base64'],
            $data['mime_type'] ?? 'image/jpeg',
            $data['instructions'] ?? null,
            $data['image_parts'] ?? []
        );

        if (empty($parsed['reference_number'])) {
            $ocrText = $this->extractVisibleTextOnly(
                $data['image_base64'],
                $data['mime_type'] ?? 'image/jpeg',
                $data['instructions'] ?? null
            );

            $parsedFromText = $this->parseTa3meedScreenText($ocrText);

            foreach ($parsedFromText as $key => $value) {
                if (($parsed[$key] ?? null) === null && $value !== null) {
                    $parsed[$key] = $value;
                }
            }

            if (! empty($parsedFromText['reference_number'])) {
                $parsed['reference_number'] = $parsedFromText['reference_number'];
                $parsed['reference_number_source'] = 'ocr_text_regex';
            }

            $parsed['ocr_text_preview'] = mb_substr($ocrText, 0, 1200);
        }

        if (empty($parsed['reference_number'])) {
            $referenceRetry = $this->extractReferenceNumberOnly(
                $data['image_base64'],
                $data['mime_type'] ?? 'image/jpeg',
                $data['instructions'] ?? null
            );

            if ($referenceRetry) {
                $parsed['reference_number'] = $referenceRetry;
                $parsed['reference_number_source'] = 'vision_retry';
            }
        }

        if (empty($parsed['reference_number']) && ! empty($data['manual_reference_number'])) {
            $parsed['reference_number'] = trim($data['manual_reference_number']);
            $parsed['reference_number_source'] = 'manual';
        }

        if (empty($parsed['reference_number'])) {
            return response()->json([
                'message' => 'لم يتم التعرف على رقم الفرصة من الصورة. اكتب رقم الفرصة يدويًا أو قرّب الصورة أكثر. النص المقروء من الصورة مرفق للمراجعة.',
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

    private function extractByVision(string $base64, string $mimeType, ?string $instructions = null, array $imageParts = []): array
    {
        $base64 = preg_replace('/^data:image\/[a-zA-Z0-9.+-]+;base64,/', '', $base64);
        $imageUrl = 'data:' . $mimeType . ';base64,' . $base64;

        $payload = [
            'model' => config('services.openai.vision_model') ?: env('OPENAI_VISION_MODEL', 'gpt-4o'),
            'response_format' => ['type' => 'json_object'],
            'messages' => [[
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'text',
                        'text' =>
                            "هذه لقطة شاشة فرصة من منصة تعميد. استخرج البيانات من الصورة بدقة.\n" .
                            "رقم الفرصة يظهر غالبًا في الهيدر الأخضر أعلى الصورة أسفل اسم المنشأة، ويظهر أيضًا في بطاقة مكتوب تحتها: رقم الفرصة.\n" .
                            "مثال رقم فرصة صحيح: ER-XHYI565. انتبه أن الحرف I قد يشبه الرقم 1.\n" .
                            "قيمة الاستثمار تظهر بجانب كلمة استثمار أو داخل بطاقة قيمة استثمار.\n" .
                            "الربح المتوقع يظهر تحت المبلغ أو داخل بطاقة ربح متوقع.\n" .
                            "مدة التمويل تظهر مثل: 6 شهر.\n" .
                            "صافي العائد السنوي يظهر مثل: 12.96%.\n" .
                            "إذا كان تاريخ الاستحقاق '-' اجعله null.\n" .
                            ($instructions ? "تعليمات المستخدم: " . $instructions . "\n" : "") .
                            "أعد JSON فقط بالمفاتيح التالية:\n" .
                            "reference_number, company_name, sector, principal_amount, expected_profit_amount, expected_rate, months, maturity_date, category, notes.\n" .
                            "لا تخمن أي قيمة غير واضحة، اجعلها null."
                    ],
                    [
                        'type' => 'image_url',
                        'image_url' => [
                            'url' => $imageUrl,
                            'detail' => 'high',
                        ],
                    ],
                    ...$this->imagePartsContent($imageParts),
                ],
            ]],
        ];

        $raw = $this->openAiChat($payload);

        if (! $raw['ok']) {
            return [
                'reference_number' => null,
                'error' => $raw['error'],
                'status' => $raw['status'],
            ];
        }

        $json = json_decode($raw['body'], true);
        $content = $json['choices'][0]['message']['content'] ?? '{}';
        $parsed = json_decode($content, true);

        if (! is_array($parsed)) {
            $parsed = [];
        }

        if (empty($parsed['reference_number']) && preg_match('/\b[A-Z]{2,}-[A-Z0-9]{4,}\b/u', mb_strtoupper($content), $m)) {
            $parsed['reference_number'] = $m[0];
        }

        return $this->normalizeParsed($parsed);
    }


    private function imagePartsContent(array $imageParts): array
    {
        $content = [];

        foreach ($imageParts as $part) {
            $base64 = $part['base64'] ?? null;
            if (! $base64) {
                continue;
            }

            $mimeType = $part['mime_type'] ?? 'image/jpeg';
            $label = $part['label'] ?? 'cropped_part';
            $base64 = preg_replace('/^data:image\/[a-zA-Z0-9.+-]+;base64,/', '', $base64);

            $content[] = [
                'type' => 'text',
                'text' => 'الصورة التالية قصّة مكبرة من لقطة تعميد: ' . $label,
            ];

            $content[] = [
                'type' => 'image_url',
                'image_url' => [
                    'url' => 'data:' . $mimeType . ';base64,' . $base64,
                    'detail' => 'high',
                ],
            ];
        }

        return $content;
    }

    private function extractVisibleTextOnly(string $base64, string $mimeType, ?string $instructions = null): string
    {
        $base64 = preg_replace('/^data:image\/[a-zA-Z0-9.+-]+;base64,/', '', $base64);
        $imageUrl = 'data:' . $mimeType . ';base64,' . $base64;

        $payload = [
            'model' => config('services.openai.vision_model') ?: env('OPENAI_VISION_MODEL', 'gpt-4o'),
            'messages' => [[
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'text',
                        'text' =>
                            "انسخ كل النصوص الظاهرة في لقطة الشاشة كما هي، سطرًا بسطر.\n" .
                            "لا تستخرج JSON ولا تشرح. فقط النصوص المرئية.\n" .
                            "ركز جدًا على الهيدر الأخضر أعلى الصورة، وبطاقات المؤشرات المالية أسفل الصورة.\n" .
                            "رقم الفرصة قد يظهر بصيغة ER-XHYI565 أو ER-XHY1565 أو قريب منها.\n" .
                            "انسخ الحروف الإنجليزية والأرقام بدقة، ولا تستبدل I بالرقم 1 إلا إذا ظهر رقمًا فعلاً.\n" .
                            ($instructions ? "تعليمات المستخدم: " . $instructions . "\n" : "")
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

        $raw = $this->openAiChat($payload);

        if (! $raw['ok']) {
            return '';
        }

        $json = json_decode($raw['body'], true);

        return trim((string) ($json['choices'][0]['message']['content'] ?? ''));
    }

    private function extractReferenceNumberOnly(string $base64, string $mimeType, ?string $instructions = null): ?string
    {
        $base64 = preg_replace('/^data:image\/[a-zA-Z0-9.+-]+;base64,/', '', $base64);
        $imageUrl = 'data:' . $mimeType . ';base64,' . $base64;

        $payload = [
            'model' => config('services.openai.vision_model') ?: env('OPENAI_VISION_MODEL', 'gpt-4o'),
            'messages' => [[
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'text',
                        'text' =>
                            "هذه لقطة شاشة من فرصة تعميد. المطلوب استخراج رقم الفرصة فقط.\n" .
                            "ابحث في أعلى الهيدر الأخضر تحت اسم المنشأة، وابحث أيضًا في بطاقة المؤشرات المالية التي تحتها عبارة: رقم الفرصة.\n" .
                            "رقم الفرصة غالبًا بصيغة مثل ER-XHYI565 أو ER-XHY1565 أو PB-XXXXX.\n" .
                            "لا ترجع أي شرح. أعد رقم الفرصة فقط كنص واحد.\n" .
                            "انتبه للفرق بين الحرف I والرقم 1.\n" .
                            ($instructions ? "تعليمات المستخدم: " . $instructions . "\n" : "")
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

        $raw = $this->openAiChat($payload);

        if (! $raw['ok']) {
            return null;
        }

        $json = json_decode($raw['body'], true);
        $content = mb_strtoupper(trim((string) ($json['choices'][0]['message']['content'] ?? '')));

        if (preg_match('/\b[A-Z]{2,}-[A-Z0-9]{4,}\b/u', $content, $m)) {
            return $m[0];
        }

        return null;
    }

    private function parseTa3meedScreenText(string $text): array
    {
        $normalized = str_replace(["\u{200f}", "\u{200e}", ',', '٬'], ['', '', '', ''], $text);
        $upper = mb_strtoupper($normalized);

        $reference = null;

        $patterns = [
            '/\b[A-Z]{2,}-[A-Z0-9]{4,}\b/u',
            '/\bER[-\s]*[A-Z0-9]{4,}\b/u',
            '/(?:رقم\s*الفرصة|الفرصة)\s*[:\-]?\s*([A-Z]{2,}-[A-Z0-9]{4,})/u',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $upper, $m)) {
                $reference = str_replace(' ', '', $m[1] ?? $m[0]);
                break;
            }
        }

        $principal = null;
        if (preg_match('/(?:قيمة\s*استثمار|استثمار)\D*([0-9]+(?:\.[0-9]+)?)/u', $normalized, $m)) {
            $principal = $this->numberOrNull($m[1]);
        }

        if ($principal === null && preg_match('/\b([0-9]{2,6})\s*(?:ر\.س|ريال|﷼)?\b/u', $normalized, $m)) {
            $principal = $this->numberOrNull($m[1]);
        }

        $profit = null;
        if (preg_match('/(?:ربح\s*متوقع|متوقع)\D*([0-9]+(?:\.[0-9]+)?)/u', $normalized, $m)) {
            $profit = $this->numberOrNull($m[1]);
        }

        $months = null;
        if (preg_match('/([0-9]+)\s*شهر/u', $normalized, $m)) {
            $months = (int) $m[1];
        }

        $rate = null;
        if (preg_match('/([0-9]+(?:\.[0-9]+)?)\s*%/u', $normalized, $m)) {
            $rate = $this->numberOrNull($m[1]);
        }

        $company = null;
        $sector = null;
        $lines = array_values(array_filter(array_map('trim', preg_split('/\R/u', $text))));

        foreach ($lines as $i => $line) {
            if ($reference && str_contains(mb_strtoupper($line), $reference)) {
                if ($i >= 2) {
                    $company = $this->text($lines[$i - 2] ?? null);
                    $sector = $this->text($lines[$i - 1] ?? null);
                }
                break;
            }
        }

        return [
            'reference_number' => $reference,
            'company_name' => $company,
            'sector' => $sector,
            'principal_amount' => $principal,
            'expected_profit_amount' => $profit,
            'expected_rate' => $rate,
            'months' => $months,
            'maturity_date' => null,
            'category' => null,
            'notes' => null,
        ];
    }

    private function openAiChat(array $payload): array
    {
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

        $body = curl_exec($ch);
        $error = curl_error($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        return [
            'ok' => $body !== false && $status < 400,
            'body' => $body ?: '',
            'error' => $error ?: $body,
            'status' => $status,
        ];
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

        
        if (! $existing) {
            $hasUsefulData =
                (($row['principal_amount'] ?? null) !== null && (float) $row['principal_amount'] > 0)
                || (($row['expected_profit_amount'] ?? null) !== null && (float) $row['expected_profit_amount'] > 0)
                || (($row['expected_rate'] ?? null) !== null && (float) $row['expected_rate'] > 0)
                || (($row['months'] ?? null) !== null && (int) $row['months'] > 0);

            if (! $hasUsefulData) {
                abort(response()->json([
                    'message' => 'تم التعرف على رقم الفرصة فقط، لكن لم تُقرأ أي بيانات مالية من الصورة. لم يتم إنشاء فرصة فارغة.',
                    'data' => [
                        'parsed' => $row,
                    ],
                ], 422));
            }
        }

        $oldMeta = $existing ? $this->decodeMeta($existing->metadata ?? null) : [];
        $meta = $oldMeta;

        foreach (['category', 'months', 'company_name', 'sector'] as $key) {
            if (($row[$key] ?? null) !== null && $row[$key] !== '') {
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

        if (($row['principal_amount'] ?? null) !== null) $payload['principal_amount'] = $row['principal_amount'];
        if (($row['expected_profit_amount'] ?? null) !== null) $payload['expected_profit_amount'] = $row['expected_profit_amount'];
        if (($row['expected_rate'] ?? null) !== null) $payload['expected_rate'] = $row['expected_rate'];
        if (($row['maturity_date'] ?? null) !== null) $payload['maturity_date'] = $row['maturity_date'];
        if (($row['notes'] ?? null) !== null) $payload['notes'] = $row['notes'];
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

        $clean = str_replace([',', '٬', 'ر.س', 'ريال', '%', ' '], '', (string) $value);

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
