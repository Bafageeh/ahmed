<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_capture_devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->uuid('installation_id');
            $table->string('label', 120)->default('جهاز أندرويد');
            $table->char('token_hash', 64)->nullable()->unique();
            $table->boolean('enabled')->default(true);
            $table->unsignedBigInteger('capture_from_ms');
            $table->timestamp('last_received_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'installation_id']);
        });

        Schema::create('sms_archive_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->uuid('device_id');
            $table->uuid('client_id');
            $table->text('sender');
            $table->char('sender_hash', 64);
            $table->longText('body');
            $table->unsignedBigInteger('received_at_ms');
            $table->unsignedBigInteger('sent_at_ms')->nullable();
            $table->integer('subscription_id')->nullable();
            $table->integer('sim_slot')->nullable();
            $table->timestamps();
            $table->foreign('device_id')->references('id')->on('sms_capture_devices')->cascadeOnDelete();
            $table->unique(['device_id', 'client_id']);
            $table->index(['user_id', 'received_at_ms']);
            $table->index(['user_id', 'sender_hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_archive_messages');
        Schema::dropIfExists('sms_capture_devices');
    }
};
