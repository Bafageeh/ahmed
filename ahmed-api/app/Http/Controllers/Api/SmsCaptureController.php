<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Ta3meedSmsParser;
use App\Support\Ta3meedSmsProcessor;
use App\Support\Ta3meedInvestmentSmsParser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class SmsCaptureController extends Controller
{
    private function owner(Request $request): int
    {
        $id = (int) $request->attributes->get('ahmed_user_id', 0);
        abort_unless($id > 0, 401);

        return $id;
    }

    public function registerDevice(Request $request)
    {
        $data = $request->validate([
            'installation_id' => ['required', 'uuid'],
            'label' => ['nullable', 'string', 'max:120'],
        ]);
        $owner = $this->owner($request);
        $token = Str::random(80);
        $serverTime = (int) floor(microtime(true) * 1000);

        $device = DB::transaction(function () use ($data, $owner, $token, $serverTime) {
            $existing = DB::table('sms_capture_devices')->where('user_id', $owner)
                ->where('installation_id', $data['installation_id'])->lockForUpdate()->first();
            $id = $existing->id ?? (string) Str::uuid();
            $values = [
                'label' => $data['label'] ?? 'جهاز أندرويد',
                'token_hash' => hash('sha256', $token),
                'enabled' => true,
                'updated_at' => now(),
            ];
            if ($existing) {
                DB::table('sms_capture_devices')->where('id', $id)->update($values);
            } else {
                DB::table('sms_capture_devices')->insert($values + [
                    'id' => $id, 'user_id' => $owner, 'installation_id' => $data['installation_id'],
                    'capture_from_ms' => $serverTime, 'created_at' => now(),
                ]);
            }

            return DB::table('sms_capture_devices')->where('id', $id)->first();
        });

        // This device token permits SMS ingestion only, never access to account data.
        return response()->json([
            'data' => ['installation_id' => $device->installation_id, 'capture_from_ms' => (int) $device->capture_from_ms, 'allowed_senders' => ['Ta3meed'], 'capture_policy_version' => 2],
            'upload_token' => $token,
            'server_time_ms' => $serverTime,
        ])->header('Cache-Control', 'no-store, private');
    }

    public function disableDevice(Request $request, string $installation)
    {
        DB::table('sms_capture_devices')->where('user_id', $this->owner($request))
            ->where('installation_id', $installation)->update([
                'enabled' => false, 'token_hash' => null, 'updated_at' => now(),
            ]);

        return response()->json(['disabled' => true]);
    }

    public function ingest(Request $request)
    {
        $token = (string) $request->header('X-Ahmed-SMS-Token', '');
        abort_unless(strlen($token) >= 40 && strlen($token) <= 200, 401);
        $device = DB::table('sms_capture_devices')->where('token_hash', hash('sha256', $token))
            ->where('enabled', true)->first();
        abort_unless($device, 401);
        abort_if(strlen($request->getContent()) > 2_000_000, 413);

        // Validate original JSON so global TrimStrings middleware cannot alter SMS text or sender.
        $payload = json_decode($request->getContent(), true);
        abort_unless(is_array($payload), 422);
        $data = Validator::make($payload, [
            'messages' => ['required', 'array', 'min:1', 'max:50'],
            'messages.*.client_id' => ['required', 'uuid', 'distinct'],
            'messages.*.sender' => ['present', 'string', 'max:256'],
            'messages.*.body' => ['present', 'string', 'max:100000'],
            'messages.*.received_at_ms' => ['required', 'integer', 'min:'.$device->capture_from_ms, 'max:'.((int) floor(microtime(true) * 1000) + 600_000)],
            'messages.*.sent_at_ms' => ['nullable', 'integer', 'min:0'],
            'messages.*.subscription_id' => ['nullable', 'integer', 'min:0'],
            'messages.*.sim_slot' => ['nullable', 'integer', 'min:0', 'max:100'],
        ])->validate();

        $result = DB::transaction(function () use ($device, $data) {
            // One account lock serializes matching and deduplication across all its devices.
            DB::table('users')->where('id', $device->user_id)->lockForUpdate()->first();
            // Serialize with token revocation; a disabled token cannot write a later batch.
            $current = DB::table('sms_capture_devices')->where('id', $device->id)->lockForUpdate()->first();
            abort_unless($current && $current->enabled && hash_equals((string) $current->token_hash, (string) $device->token_hash), 401);
            $accepted = [];
            $outcomes = [];
            $ignored = [];
            foreach ($data['messages'] as $message) {
                $sender = $message['sender'];
                $accepted[] = $message['client_id'];
                // Acknowledge excluded senders so an older client's queue can drain without storing them.
                if (! Ta3meedSmsParser::allowedSender($sender)) {
                    $ignored[] = $message['client_id'];
                    continue;
                }
                $inserted = DB::table('sms_archive_messages')->insertOrIgnore([
                    'user_id' => $device->user_id, 'device_id' => $device->id,
                    'client_id' => $message['client_id'],
                    'sender' => Crypt::encryptString($sender),
                    'sender_hash' => hash_hmac('sha256', $sender, (string) config('app.key')),
                    'body' => Crypt::encryptString($message['body']),
                    'received_at_ms' => $message['received_at_ms'],
                    'sent_at_ms' => $message['sent_at_ms'] ?? null,
                    'subscription_id' => $message['subscription_id'] ?? null,
                    'sim_slot' => $message['sim_slot'] ?? null,
                    'analysis_status' => 'pending',
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                $row = DB::table('sms_archive_messages')->where('device_id', $device->id)->where('client_id', $message['client_id'])->first();
                if ($inserted) {
                    try {
                        // A failed update rolls back its receipt changes while retaining the archived SMS.
                        DB::transaction(fn () => app(Ta3meedSmsProcessor::class)->process($row, $message['body']));
                    } catch (\Throwable $error) {
                        DB::table('sms_archive_messages')->where('id', $row->id)->update([
                            'analysis_status' => 'needs_review', 'analysis_reason' => 'processing_failed', 'analyzed_at' => now(), 'updated_at' => now(),
                        ]);
                        logger()->warning('SMS payment analysis failed', ['message_id' => $row->id, 'error_type' => get_class($error)]);
                    }
                    $row = DB::table('sms_archive_messages')->where('id', $row->id)->first();
                }
                $outcomes[] = Ta3meedSmsProcessor::outcome($row);
            }
            DB::table('sms_capture_devices')->where('id', $device->id)->update(['last_received_at' => now(), 'updated_at' => now()]);

            return ['accepted_client_ids' => $accepted, 'ignored_client_ids' => $ignored, 'outcomes' => $outcomes, 'allowed_senders' => ['Ta3meed'], 'capture_policy_version' => 2];
        });

        // The transaction has committed before an app can show a completion notification.
        return response()->json($result)->header('Cache-Control', 'no-store, private');
    }

    public function index(Request $request)
    {
        $owner = $this->owner($request);
        $query = DB::table('sms_archive_messages')->where('user_id', $owner)->where('analysis_status', '!=', 'dismissed');
        if ($request->filled('sender')) {
            $query->where('sender_hash', hash_hmac('sha256', (string) $request->input('sender'), (string) config('app.key')));
        }
        $total = (clone $query)->count();
        if ($request->filled('before_id')) {
            $query->where('id', '<', max(0, (int) $request->input('before_id')));
        }
        $rows = $query->orderByDesc('id')->limit(51)->get();
        $hasMore = $rows->count() > 50;
        $items = $rows->take(50)->map(function ($row) {
            $body = Crypt::decryptString($row->body);
            return [
            'id' => $row->id, 'sender' => Crypt::decryptString($row->sender),
            'body' => $body, 'received_at_ms' => (int) $row->received_at_ms,
            'sent_at_ms' => $row->sent_at_ms === null ? null : (int) $row->sent_at_ms,
            'subscription_id' => $row->subscription_id, 'sim_slot' => $row->sim_slot,
            'analysis' => Ta3meedSmsProcessor::outcome(Ta3meedInvestmentSmsParser::forDisplay($row, $body)),
        ]; })->values();

        return response()->json(['data' => $items, 'total' => $total, 'has_more' => $hasMore,
            'dismissed_ids' => DB::table('sms_archive_messages')->where('user_id', $owner)->where('analysis_status', 'dismissed')->pluck('id')])
            ->header('Cache-Control', 'no-store, private');
    }
}
