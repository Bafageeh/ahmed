<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sms_archive_messages', function (Blueprint $table) {
            $table->unsignedBigInteger('investment_opportunity_id')->nullable();
            $table->char('investment_decision_hash', 64)->nullable();
            $table->index(['user_id', 'analysis_status'], 'sms_owner_analysis_state');
        });
    }

    public function down(): void
    {
        Schema::table('sms_archive_messages', function (Blueprint $table) {
            $table->dropIndex('sms_owner_analysis_state');
            $table->dropColumn(['investment_opportunity_id', 'investment_decision_hash']);
        });
    }
};
