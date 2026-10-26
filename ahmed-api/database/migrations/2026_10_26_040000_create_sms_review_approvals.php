<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_review_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('message_id')->unique()->constrained('sms_archive_messages')->cascadeOnDelete();
            $table->unsignedBigInteger('wallet_entry_id')->nullable();
            $table->unsignedBigInteger('receipt_id')->nullable();
            $table->json('decision');
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_review_approvals');
    }
};
