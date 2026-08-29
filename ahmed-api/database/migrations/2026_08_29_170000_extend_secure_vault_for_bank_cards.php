<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('secure_vault_items')) {
            return;
        }

        Schema::table('secure_vault_items', function (Blueprint $table) {
            if (! Schema::hasColumn('secure_vault_items', 'username_encrypted')) {
                $table->text('username_encrypted')->nullable()->after('username');
            }
            if (! Schema::hasColumn('secure_vault_items', 'card_type')) {
                $table->string('card_type', 20)->nullable()->after('card_brand');
            }
            if (! Schema::hasColumn('secure_vault_items', 'statement_day')) {
                $table->unsignedTinyInteger('statement_day')->nullable()->after('expiry_year');
            }
            if (! Schema::hasColumn('secure_vault_items', 'credit_card_debt_id')) {
                $table->unsignedBigInteger('credit_card_debt_id')->nullable()->index()->after('statement_day');
            }
            if (! Schema::hasColumn('secure_vault_items', 'sadad_number_encrypted')) {
                $table->text('sadad_number_encrypted')->nullable()->after('credit_card_debt_id');
            }
        });

        // Migrate any legacy plaintext usernames into encrypted storage, then erase plaintext.
        DB::table('secure_vault_items')
            ->whereNotNull('username')
            ->where('username', '<>', '')
            ->orderBy('id')
            ->chunkById(100, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('secure_vault_items')->where('id', $row->id)->update([
                        'username_encrypted' => Crypt::encryptString((string) $row->username),
                        'username' => null,
                        'updated_at' => now(),
                    ]);
                }
            });
    }

    public function down(): void
    {
        // Compatibility migration: keep encrypted vault data on rollback.
    }
};
