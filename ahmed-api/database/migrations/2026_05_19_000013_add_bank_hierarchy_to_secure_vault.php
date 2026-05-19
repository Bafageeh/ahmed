<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('secure_vault_items')) {
            return;
        }

        Schema::table('secure_vault_items', function (Blueprint $table) {
            if (! Schema::hasColumn('secure_vault_items', 'parent_bank_id')) {
                $table->unsignedBigInteger('parent_bank_id')->nullable()->index()->after('user_id');
            }
            if (! Schema::hasColumn('secure_vault_items', 'linked_account_id')) {
                $table->unsignedBigInteger('linked_account_id')->nullable()->index()->after('parent_bank_id');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('secure_vault_items')) {
            return;
        }

        Schema::table('secure_vault_items', function (Blueprint $table) {
            if (Schema::hasColumn('secure_vault_items', 'linked_account_id')) {
                $table->dropColumn('linked_account_id');
            }
            if (Schema::hasColumn('secure_vault_items', 'parent_bank_id')) {
                $table->dropColumn('parent_bank_id');
            }
        });
    }
};
