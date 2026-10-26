<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ta3meed_wallet_entries', function (Blueprint $table) {
            $table->unsignedBigInteger('investment_opportunity_id')->nullable();
            $table->unique(['user_id', 'investment_opportunity_id'], 'ta3meed_wallet_investment_once');
        });
    }

    public function down(): void
    {
        Schema::table('ta3meed_wallet_entries', function (Blueprint $table) {
            $table->dropUnique('ta3meed_wallet_investment_once');
            $table->dropColumn('investment_opportunity_id');
        });
    }
};
