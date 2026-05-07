<?php

namespace App\Console\Commands;

use App\Services\WhatsAppService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class DispatchWhatsAppMessages extends Command
{
    protected $signature = 'whatsapp:dispatch-scheduled {--limit=25}';

    protected $description = 'Dispatch due pending WhatsApp messages.';

    public function handle(WhatsAppService $whatsApp): int
    {
        if (! $whatsApp->enabled()) {
            $this->warn('WhatsApp is not configured.');
            return self::FAILURE;
        }

        $limit = max(1, min((int) $this->option('limit'), 100));

        $messages = DB::table('whatsapp_messages')
            ->where('direction', 'outbound')
            ->where('status', 'pending')
            ->where(function ($query) {
                $query->whereNull('scheduled_at')
                    ->orWhere('scheduled_at', '<=', now());
            })
            ->orderBy('scheduled_at')
            ->orderBy('id')
            ->limit($limit)
            ->get();

        foreach ($messages as $message) {
            DB::table('whatsapp_messages')->where('id', $message->id)->update([
                'status' => 'sending',
                'attempts' => ((int) $message->attempts) + 1,
                'updated_at' => now(),
            ]);

            try {
                if ($message->message_type === 'template') {
                    $response = $whatsApp->sendTemplate(
                        $message->to_phone,
                        (string) $message->template_name,
                        json_decode($message->parameters ?: '[]', true) ?: [],
                        (string) ($message->language ?: 'ar')
                    );
                } else {
                    $response = $whatsApp->sendText($message->to_phone, (string) $message->body);
                }

                DB::table('whatsapp_messages')->where('id', $message->id)->update([
                    'status' => 'sent',
                    'sent_at' => now(),
                    'provider_message_id' => data_get($response, 'messages.0.id'),
                    'response_payload' => json_encode($response),
                    'updated_at' => now(),
                ]);

                $this->info("Sent WhatsApp message #{$message->id}");
            } catch (Throwable $exception) {
                DB::table('whatsapp_messages')->where('id', $message->id)->update([
                    'status' => 'failed',
                    'failed_at' => now(),
                    'error_message' => $exception->getMessage(),
                    'updated_at' => now(),
                ]);

                $this->error("Failed WhatsApp message #{$message->id}: {$exception->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
