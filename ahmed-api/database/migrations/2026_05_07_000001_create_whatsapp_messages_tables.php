<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_messages', function (Blueprint $table) {
            $table->id();
            $table->string('direction', 20)->default('outbound')->index();
            $table->string('status', 30)->default('pending')->index();
            $table->string('message_type', 30)->default('text');
            $table->string('from_phone')->nullable();
            $table->string('to_phone')->index();
            $table->string('template_name')->nullable();
            $table->string('language', 10)->default('ar');
            $table->text('body')->nullable();
            $table->json('parameters')->nullable();
            $table->nullableMorphs('related');
            $table->timestamp('scheduled_at')->nullable()->index();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->string('provider_message_id')->nullable()->index();
            $table->text('error_message')->nullable();
            $table->json('response_payload')->nullable();
            $table->timestamps();
        });

        Schema::create('whatsapp_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_type')->nullable()->index();
            $table->string('provider_message_id')->nullable()->index();
            $table->string('from_phone')->nullable()->index();
            $table->json('payload');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_webhook_events');
        Schema::dropIfExists('whatsapp_messages');
    }
};
