<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private string $phoneBankingTag = '__phone_banking__';

    public function up(): void
    {
        if (! Schema::hasTable('secure_vault_items')
            || ! Schema::hasColumn('secure_vault_items', 'username_encrypted')
            || ! Schema::hasColumn('secure_vault_items', 'security_question_encrypted')) {
            return;
        }

        DB::transaction(function () {
            $banks = DB::table('secure_vault_items')
                ->where('category', 'banks')
                ->whereNotNull('security_question_encrypted')
                ->where('security_question_encrypted', '<>', '')
                ->get(['id', 'user_id', 'security_question_encrypted']);

            foreach ($banks as $bank) {
                $ownerGroup = 'bank:' . $bank->id;
                $existing = DB::table('secure_vault_items')
                    ->where('owner_group', $ownerGroup)
                    ->where('category', 'subscriptions')
                    ->where('record_type', 'subscription')
                    ->where('tags', $this->phoneBankingTag)
                    ->first();

                if ($existing) {
                    if (empty($existing->username_encrypted)) {
                        DB::table('secure_vault_items')->where('id', $existing->id)->update([
                            'username_encrypted' => $bank->security_question_encrypted,
                            'updated_at' => now(),
                        ]);
                    }
                } else {
                    DB::table('secure_vault_items')->insert([
                        'user_id' => $bank->user_id,
                        'owner_group' => $ownerGroup,
                        'category' => 'subscriptions',
                        'record_type' => 'subscription',
                        'is_favorite' => false,
                        'title' => 'الهاتف المصرفي',
                        'username' => null,
                        'username_encrypted' => $bank->security_question_encrypted,
                        'tags' => $this->phoneBankingTag,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                DB::table('secure_vault_items')->where('id', $bank->id)->update([
                    'security_question_encrypted' => null,
                    'updated_at' => now(),
                ]);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('secure_vault_items')
            || ! Schema::hasColumn('secure_vault_items', 'username_encrypted')
            || ! Schema::hasColumn('secure_vault_items', 'security_question_encrypted')) {
            return;
        }

        DB::transaction(function () {
            $items = DB::table('secure_vault_items')
                ->where('category', 'subscriptions')
                ->where('record_type', 'subscription')
                ->where('tags', $this->phoneBankingTag)
                ->whereNotNull('username_encrypted')
                ->where('username_encrypted', '<>', '')
                ->get(['id', 'owner_group', 'username_encrypted']);

            foreach ($items as $item) {
                if (! preg_match('/^bank:(\d+)$/', (string) $item->owner_group, $matches)) {
                    continue;
                }

                $bankId = (int) $matches[1];
                $bank = DB::table('secure_vault_items')
                    ->where('id', $bankId)
                    ->where('category', 'banks')
                    ->first(['id', 'security_question_encrypted']);

                if ($bank && empty($bank->security_question_encrypted)) {
                    DB::table('secure_vault_items')->where('id', $bankId)->update([
                        'security_question_encrypted' => $item->username_encrypted,
                        'updated_at' => now(),
                    ]);
                }
            }
        });
    }
};
