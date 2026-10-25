<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sms_archive_messages', function (Blueprint $table) {
            // Previously archived messages must never become automatic payment inputs.
            $table->string('analysis_status', 30)->default('archived');
            $table->string('analysis_reason', 100)->nullable();
            $table->string('payment_reference', 100)->nullable();
            $table->decimal('payment_amount', 14, 2)->nullable();
            $table->unsignedBigInteger('receipt_id')->nullable();
            $table->char('payment_fingerprint', 64)->nullable();
            $table->timestamp('analyzed_at')->nullable();
            $table->index(['user_id', 'payment_fingerprint'], 'sms_owner_payment_fingerprint');
        });
    }

    public function down(): void
    {
        Schema::table('sms_archive_messages', function (Blueprint $table) {
            $table->dropIndex('sms_owner_payment_fingerprint');
            $table->dropColumn(['analysis_status', 'analysis_reason', 'payment_reference', 'payment_amount', 'receipt_id', 'payment_fingerprint', 'analyzed_at']);
        });
    }
};
