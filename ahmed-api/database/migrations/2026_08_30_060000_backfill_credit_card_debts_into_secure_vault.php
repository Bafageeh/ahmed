<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('credit_card_debts') || ! Schema::hasTable('secure_vault_items')) {
            return;
        }

        $normalizeBankName = static function (string $value): string {
            $value = trim(mb_strtolower($value));
            $value = preg_replace('/^(بنك|البنك)\s+/u', '', $value) ?: $value;
            $value = str_replace(['أ', 'إ', 'آ', 'ة', 'ى'], ['ا', 'ا', 'ا', 'ه', 'ي'], $value);
            return preg_replace('/\s+/u', ' ', trim($value)) ?: '';
        };

        $findOrCreateBank = static function (int $userId, string $bankName) use ($normalizeBankName): int {
            $target = $normalizeBankName($bankName);
            $banks = DB::table('secure_vault_items')
                ->where('category', 'banks')
                ->where(function ($query) use ($userId) {
                    $query->whereNull('user_id')->orWhere('user_id', $userId);
                })
                ->get(['id', 'title']);

            foreach ($banks as $bank) {
                $candidate = $normalizeBankName((string) $bank->title);
                if ($candidate === $target || ($candidate !== '' && $target !== '' && (str_contains($candidate, $target) || str_contains($target, $candidate)))) {
                    return (int) $bank->id;
                }
            }

            return (int) DB::table('secure_vault_items')->insertGetId([
                'user_id' => $userId,
                'owner_group' => null,
                'category' => 'banks',
                'record_type' => 'subscription',
                'is_favorite' => false,
                'title' => trim($bankName),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        };

        $hasDebtVaultLink = Schema::hasColumn('credit_card_debts', 'secure_vault_item_id');
        $hasVaultDebtLink = Schema::hasColumn('secure_vault_items', 'credit_card_debt_id');
        $hasCardType = Schema::hasColumn('secure_vault_items', 'card_type');
        $hasParentBankId = Schema::hasColumn('secure_vault_items', 'parent_bank_id');

        $debts = DB::table('credit_card_debts')
            ->where('credit_limit', '>', 0)
            ->orderBy('id')
            ->get();

        foreach ($debts as $debt) {
            $userId = (int) $debt->user_id;
            $bankId = $findOrCreateBank($userId, (string) $debt->bank_name);
            $bankRef = 'bank:'.$bankId;
            $vault = null;

            if ($hasDebtVaultLink && ! empty($debt->secure_vault_item_id)) {
                $vault = DB::table('secure_vault_items')
                    ->where('id', (int) $debt->secure_vault_item_id)
                    ->where(function ($query) use ($userId) {
                        $query->whereNull('user_id')->orWhere('user_id', $userId);
                    })
                    ->first();
            }

            if (! $vault && $hasVaultDebtLink) {
                $vault = DB::table('secure_vault_items')
                    ->where('credit_card_debt_id', (int) $debt->id)
                    ->where(function ($query) use ($userId) {
                        $query->whereNull('user_id')->orWhere('user_id', $userId);
                    })
                    ->first();
            }

            if (! $vault) {
                $candidate = DB::table('secure_vault_items')
                    ->where('category', 'cards')
                    ->where('owner_group', $bankRef)
                    ->where('title', (string) $debt->card_name)
                    ->where(function ($query) use ($userId) {
                        $query->whereNull('user_id')->orWhere('user_id', $userId);
                    });

                if ($hasCardType) {
                    $candidate->where(function ($query) {
                        $query->whereNull('card_type')->orWhere('card_type', 'credit');
                    });
                }

                $vault = $candidate->first();
            }

            $values = [
                'owner_group' => $bankRef,
                'category' => 'cards',
                'record_type' => 'card',
                'title' => (string) $debt->card_name,
                'updated_at' => now(),
            ];

            if ($hasCardType) {
                $values['card_type'] = 'credit';
            }
            if ($hasVaultDebtLink) {
                $values['credit_card_debt_id'] = (int) $debt->id;
            }
            if ($hasParentBankId) {
                $values['parent_bank_id'] = $bankId;
            }

            if ($vault) {
                DB::table('secure_vault_items')->where('id', $vault->id)->update($values);
                $vaultId = (int) $vault->id;
            } else {
                $vaultId = (int) DB::table('secure_vault_items')->insertGetId(array_merge($values, [
                    'user_id' => $userId,
                    'is_favorite' => false,
                    'created_at' => now(),
                ]));
            }

            if ($hasDebtVaultLink) {
                DB::table('credit_card_debts')->where('id', $debt->id)->update([
                    'secure_vault_item_id' => $vaultId,
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Data-link migration is intentionally not reversed to avoid deleting user vault records.
    }
};
