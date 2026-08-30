<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credit_card_debts', function (Blueprint $table) {
            if (! Schema::hasColumn('credit_card_debts', 'secure_vault_item_id')) {
                $table->unsignedBigInteger('secure_vault_item_id')->nullable()->after('user_id')->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('credit_card_debts', function (Blueprint $table) {
            if (Schema::hasColumn('credit_card_debts', 'secure_vault_item_id')) {
                $table->dropColumn('secure_vault_item_id');
            }
        });
    }
};
