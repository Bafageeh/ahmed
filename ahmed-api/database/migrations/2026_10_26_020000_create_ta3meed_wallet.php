<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ta3meed_wallet_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('kind', 30);
            $table->bigInteger('amount_cents');
            $table->date('entry_date');
            $table->string('source', 20);
            $table->uuid('request_id')->nullable();
            $table->char('fingerprint', 64)->nullable();
            $table->string('transaction_reference', 100)->nullable();
            $table->unsignedBigInteger('receipt_id')->nullable()->unique();
            $table->unsignedBigInteger('sms_message_id')->nullable()->unique();
            $table->text('notes')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->timestamp('voided_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'request_id'], 'ta3meed_wallet_request');
            $table->unique(['user_id', 'fingerprint'], 'ta3meed_wallet_fingerprint');
            $table->index(['user_id', 'entry_date']);
        });
        Schema::create('ta3meed_wallet_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('entry_id')->constrained('ta3meed_wallet_entries')->cascadeOnDelete();
            $table->string('action', 20);
            $table->json('snapshot');
            $table->timestamp('created_at');
        });
        Schema::table('sms_archive_messages', function (Blueprint $table) {
            $table->string('action_type', 30)->nullable();
            $table->unsignedBigInteger('wallet_entry_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sms_archive_messages', fn (Blueprint $table) => $table->dropColumn(['action_type', 'wallet_entry_id']));
        Schema::dropIfExists('ta3meed_wallet_audits');
        Schema::dropIfExists('ta3meed_wallet_entries');
    }
};
