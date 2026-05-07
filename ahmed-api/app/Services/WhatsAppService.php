<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class WhatsAppService
{
    public function enabled(): bool
    {
        return filled($this->accessToken()) && filled($this->phoneNumberId());
    }

    public function normalizeSaudiPhone(?string $phone): string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);

        if ($phone === '') {
            throw new RuntimeException('رقم الجوال غير موجود.');
        }

        if (Str::startsWith($phone, '00')) {
            $phone = substr($phone, 2);
        }

        if (Str::startsWith($phone, '0')) {
            $phone = '966' . substr($phone, 1);
        }

        if (Str::startsWith($phone, '5') && strlen($phone) === 9) {
            $phone = '966' . $phone;
        }

        if (! Str::startsWith($phone, '966')) {
            $phone = ltrim((string) config('services.whatsapp.default_country_code', '966'), '+') . $phone;
        }

        return $phone;
    }

    public function sendText(string $toPhone, string $body): array
    {
        if (! $this->enabled()) {
            throw new RuntimeException('إعدادات واتساب غير مكتملة.');
        }

        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizeSaudiPhone($toPhone),
            'type' => 'text',
            'text' => [
                'preview_url' => false,
                'body' => $body,
            ],
        ];

        return $this->postMessage($payload);
    }

    public function sendTemplate(string $toPhone, string $templateName, array $parameters = [], string $language = 'ar'): array
    {
        if (! $this->enabled()) {
            throw new RuntimeException('إعدادات واتساب غير مكتملة.');
        }

        $components = [];
        if ($parameters !== []) {
            $components[] = [
                'type' => 'body',
                'parameters' => array_map(fn ($value) => [
                    'type' => 'text',
                    'text' => (string) $value,
                ], array_values($parameters)),
            ];
        }

        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizeSaudiPhone($toPhone),
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => [
                    'code' => $language,
                ],
            ],
        ];

        if ($components !== []) {
            $payload['template']['components'] = $components;
        }

        return $this->postMessage($payload);
    }

    private function postMessage(array $payload): array
    {
        $response = Http::withToken($this->accessToken())
            ->acceptJson()
            ->asJson()
            ->timeout((int) config('services.whatsapp.timeout', 15))
            ->post($this->messagesEndpoint(), $payload);

        $json = $response->json() ?? [];

        if (! $response->successful()) {
            $message = data_get($json, 'error.message') ?: 'فشل إرسال رسالة واتساب.';
            throw new RuntimeException($message);
        }

        return $json;
    }

    private function messagesEndpoint(): string
    {
        $version = config('services.whatsapp.api_version', 'v25.0');
        $phoneNumberId = $this->phoneNumberId();

        return "https://graph.facebook.com/{$version}/{$phoneNumberId}/messages";
    }

    private function accessToken(): ?string
    {
        return config('services.whatsapp.access_token');
    }

    private function phoneNumberId(): ?string
    {
        return config('services.whatsapp.phone_number_id');
    }
}
