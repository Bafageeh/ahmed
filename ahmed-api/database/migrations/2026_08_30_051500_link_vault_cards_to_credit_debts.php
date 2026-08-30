<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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

        if (Schema::hasTable('secure_vault_items') && Schema::hasColumn('secure_vault_items', 'credit_card_debt_id')) {
            DB::table('secure_vault_items')
                ->whereNotNull('credit_card_debt_id')
                ->where(function ($query) {
                    $query->where('record_type', 'card')->orWhere('category', 'cards');
                })
                ->orderBy('id')
                ->get(['id', 'credit_card_debt_id'])
                ->each(function ($item) {
                    DB::table('credit_card_debts')
                        ->where('id', $item->credit_card_debt_id)
                        ->update(['secure_vault_item_id' => $item->id]);
                });
        }
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
