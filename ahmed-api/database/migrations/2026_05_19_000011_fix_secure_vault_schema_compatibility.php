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
            if (! Schema::hasColumn('secure_vault_items', 'importance')) {
                $table->string('importance', 40)->default('normal')->index()->after('record_type');
            }

            if (! Schema::hasColumn('secure_vault_items', 'bank_name')) {
                $table->string('bank_name')->nullable()->after('tags');
            }

            if (! Schema::hasColumn('secure_vault_items', 'bank_iban_encrypted')) {
                $table->text('bank_iban_encrypted')->nullable()->after('bank_name');
            }

            if (! Schema::hasColumn('secure_vault_items', 'bank_account_short')) {
                $table->string('bank_account_short')->nullable()->after('bank_iban_encrypted');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('secure_vault_items')) {
            return;
        }

        Schema::table('secure_vault_items', function (Blueprint $table) {
            if (Schema::hasColumn('secure_vault_items', 'bank_account_short')) {
                $table->dropColumn('bank_account_short');
            }
            if (Schema::hasColumn('secure_vault_items', 'bank_iban_encrypted')) {
                $table->dropColumn('bank_iban_encrypted');
            }
            if (Schema::hasColumn('secure_vault_items', 'bank_name')) {
                $table->dropColumn('bank_name');
            }
        });
    }
};
