<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class WhatsAppController extends Controller
{
    public function status(WhatsAppService $whatsApp)
    {
        return response()->json([
            'ok' => true,
            'configured' => $whatsApp->enabled(),
            'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID') ? 'configured' : null,
            'business_account_id' => env('WHATSAPP_BUSINESS_ACCOUNT_ID') ? 'configured' : null,
            'api_version' => env('WHATSAPP_API_VERSION', 'v25.0'),
        ]);
    }

    public function sendText(Request $request, WhatsAppService $whatsApp)
    {
        $this->authorizeInternalRequest($request);

        $data = $request->validate([
            'to_phone' => ['required', 'string', 'max:30'],
            'body' => ['required', 'string', 'max:4096'],
        ]);

        $messageId = DB::table('whatsapp_messages')->insertGetId([
            'direction' => 'outbound',
            'status' => 'sending',
            'message_type' => 'text',
            'from_phone' => env('WHATSAPP_FROM_PHONE'),
            'to_phone' => $whatsApp->normalizeSaudiPhone($data['to_phone']),
            'body' => $data['body'],
            'scheduled_at' => now(),
            'attempts' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $response = $whatsApp->sendText($data['to_phone'], $data['body']);
            $providerMessageId = data_get($response, 'messages.0.id');

            DB::table('whatsapp_messages')->where('id', $messageId)->update([
                'status' => 'sent',
                'sent_at' => now(),
                'provider_message_id' => $providerMessageId,
                'response_payload' => json_encode($response),
                'updated_at' => now(),
            ]);

            return response()->json(['ok' => true, 'data' => ['id' => $messageId, 'provider_message_id' => $providerMessageId]]);
        } catch (Throwable $exception) {
            DB::table('whatsapp_messages')->where('id', $messageId)->update([
                'status' => 'failed',
                'failed_at' => now(),
                'error_message' => $exception->getMessage(),
                'updated_at' => now(),
            ]);

            return response()->json(['ok' => false, 'message' => $exception->getMessage()], 422);
        }
    }

    public function sendTemplate(Request $request, WhatsAppService $whatsApp)
    {
        $this->authorizeInternalRequest($request);

        $data = $request->validate([
            'to_phone' => ['required', 'string', 'max:30'],
            'template_name' => ['required', 'string', 'max:255'],
            'language' => ['nullable', 'string', 'max:10'],
            'parameters' => ['nullable', 'array'],
        ]);

        $language = $data['language'] ?? 'ar';
        $parameters = $data['parameters'] ?? [];

        $messageId = DB::table('whatsapp_messages')->insertGetId([
            'direction' => 'outbound',
            'status' => 'sending',
            'message_type' => 'template',
            'from_phone' => env('WHATSAPP_FROM_PHONE'),
            'to_phone' => $whatsApp->normalizeSaudiPhone($data['to_phone']),
            'template_name' => $data['template_name'],
            'language' => $language,
            'parameters' => json_encode(array_values($parameters)),
            'scheduled_at' => now(),
            'attempts' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $response = $whatsApp->sendTemplate($data['to_phone'], $data['template_name'], $parameters, $language);
            $providerMessageId = data_get($response, 'messages.0.id');

            DB::table('whatsapp_messages')->where('id', $messageId)->update([
                'status' => 'sent',
                'sent_at' => now(),
                'provider_message_id' => $providerMessageId,
                'response_payload' => json_encode($response),
                'updated_at' => now(),
            ]);

            return response()->json(['ok' => true, 'data' => ['id' => $messageId, 'provider_message_id' => $providerMessageId]]);
        } catch (Throwable $exception) {
            DB::table('whatsapp_messages')->where('id', $messageId)->update([
                'status' => 'failed',
                'failed_at' => now(),
                'error_message' => $exception->getMessage(),
                'updated_at' => now(),
            ]);

            return response()->json(['ok' => false, 'message' => $exception->getMessage()], 422);
        }
    }

    public function scheduleText(Request $request, WhatsAppService $whatsApp)
    {
        $this->authorizeInternalRequest($request);

        $data = $request->validate([
            'to_phone' => ['required', 'string', 'max:30'],
            'body' => ['required', 'string', 'max:4096'],
            'scheduled_at' => ['nullable', 'date'],
            'related_type' => ['nullable', 'string', 'max:255'],
            'related_id' => ['nullable', 'integer'],
        ]);

        $id = DB::table('whatsapp_messages')->insertGetId([
            'direction' => 'outbound',
            'status' => 'pending',
            'message_type' => 'text',
            'from_phone' => env('WHATSAPP_FROM_PHONE'),
            'to_phone' => $whatsApp->normalizeSaudiPhone($data['to_phone']),
            'body' => $data['body'],
            'scheduled_at' => $data['scheduled_at'] ?? now(),
            'related_type' => $data['related_type'] ?? null,
            'related_id' => $data['related_id'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true, 'data' => ['id' => $id, 'status' => 'pending']], 201);
    }

    public function index(Request $request)
    {
        $limit = min((int) $request->query('limit', 50), 100);

        return response()->json([
            'data' => DB::table('whatsapp_messages')->orderByDesc('id')->limit($limit)->get(),
        ]);
    }

    public function verifyWebhook(Request $request)
    {
        $mode = $request->query('hub_mode', $request->query('hub.mode'));
        $token = $request->query('hub_verify_token', $request->query('hub.verify_token'));
        $challenge = $request->query('hub_challenge', $request->query('hub.challenge'));

        if ($mode === 'subscribe' && hash_equals((string) env('WHATSAPP_WEBHOOK_VERIFY_TOKEN'), (string) $token)) {
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        return response('Forbidden', 403);
    }

    public function webhook(Request $request)
    {
        return response()->json(['ok' => true]);
    }

    private function authorizeInternalRequest(Request $request): void
    {
        $secret = (string) env('WHATSAPP_INTERNAL_SECRET');

        if ($secret === '') {
            return;
        }

        $provided = (string) $request->header('X-WhatsApp-Secret', $request->input('secret', ''));

        abort_unless(hash_equals($secret, $provided), 403, 'غير مصرح.');
    }
}
