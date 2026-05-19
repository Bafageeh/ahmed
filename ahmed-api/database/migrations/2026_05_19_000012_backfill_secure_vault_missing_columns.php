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
            if (! Schema::hasColumn('secure_vault_items', 'owner_group')) {
                $table->string('owner_group', 80)->nullable()->index()->after('user_id');
            }
            if (! Schema::hasColumn('secure_vault_items', 'importance')) {
                $table->string('importance', 40)->default('normal')->index()->after('record_type');
            }
            if (! Schema::hasColumn('secure_vault_items', 'is_favorite')) {
                $table->boolean('is_favorite')->default(false)->index()->after('record_type');
            }
            if (! Schema::hasColumn('secure_vault_items', 'url')) {
                $table->string('url')->nullable()->after('password_encrypted');
            }
            if (! Schema::hasColumn('secure_vault_items', 'email')) {
                $table->string('email')->nullable()->after('url');
            }
            if (! Schema::hasColumn('secure_vault_items', 'phone')) {
                $table->string('phone')->nullable()->after('email');
            }
            if (! Schema::hasColumn('secure_vault_items', 'purpose')) {
                $table->string('purpose')->nullable()->after('phone');
            }
            if (! Schema::hasColumn('secure_vault_items', 'tags')) {
                $table->string('tags')->nullable()->after('purpose');
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
            if (! Schema::hasColumn('secure_vault_items', 'cardholder_name')) {
                $table->string('cardholder_name')->nullable()->after('tags');
            }
            if (! Schema::hasColumn('secure_vault_items', 'card_brand')) {
                $table->string('card_brand')->nullable()->after('cardholder_name');
            }
            if (! Schema::hasColumn('secure_vault_items', 'card_number_encrypted')) {
                $table->text('card_number_encrypted')->nullable()->after('card_brand');
            }
            if (! Schema::hasColumn('secure_vault_items', 'card_last_four')) {
                $table->string('card_last_four', 4)->nullable()->after('card_number_encrypted');
            }
            if (! Schema::hasColumn('secure_vault_items', 'card_cvv_encrypted')) {
                $table->text('card_cvv_encrypted')->nullable()->after('card_last_four');
            }
            if (! Schema::hasColumn('secure_vault_items', 'expiry_month')) {
                $table->unsignedTinyInteger('expiry_month')->nullable()->after('card_cvv_encrypted');
            }
            if (! Schema::hasColumn('secure_vault_items', 'expiry_year')) {
                $table->unsignedSmallInteger('expiry_year')->nullable()->after('expiry_month');
            }
            if (! Schema::hasColumn('secure_vault_items', 'security_question_encrypted')) {
                $table->text('security_question_encrypted')->nullable()->after('expiry_year');
            }
            if (! Schema::hasColumn('secure_vault_items', 'security_answer_encrypted')) {
                $table->text('security_answer_encrypted')->nullable()->after('security_question_encrypted');
            }
            if (! Schema::hasColumn('secure_vault_items', 'backup_codes_encrypted')) {
                $table->text('backup_codes_encrypted')->nullable()->after('security_answer_encrypted');
            }
            if (! Schema::hasColumn('secure_vault_items', 'last_viewed_at')) {
                $table->timestamp('last_viewed_at')->nullable()->after('notes_encrypted');
            }
        });
    }

    public function down(): void
    {
        // Compatibility migration: do not drop columns on rollback.
    }
};
