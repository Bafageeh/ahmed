<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CreditCardDebtController extends Controller
{
    public function index(Request $request)
    {
        $this->syncAllDebtsToVault($request);

        $items = DB::table('credit_card_debts')
            ->where('user_id', $this->userId($request))
            ->orderBy('bank_name')
            ->orderBy('card_name')
            ->orderBy('id')
            ->get()
            ->map(fn ($item) => $this->normalize($item));

        $total = $items->sum(fn ($item) => (float) $item['credit_limit']);
        $count = $items->count();
        $highest = $items->sortByDesc('credit_limit')->first();

        return response()->json([
            'data' => $items->values(),
            'summary' => [
                'cards_count' => $count,
                'total_debt' => round($total, 2),
                'highest_limit' => $highest ? round((float) $highest['credit_limit'], 2) : 0,
                'highest_card' => $highest,
                'average_limit' => $count > 0 ? round($total / $count, 2) : 0,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);
        $now = now();
        $values = [
            'user_id' => $this->userId($request),
            'bank_name' => $data['bank_name'],
            'card_name' => $data['card_name'],
            'credit_limit' => $data['credit_limit'],
            'created_at' => $now,
            'updated_at' => $now,
        ];

        if ($this->hasVaultLinkColumn()) {
            $values['secure_vault_item_id'] = null;
        }

        $id = DB::table('credit_card_debts')->insertGetId($values);
        $this->syncVaultCardFromDebt($request, $id, $data);

        return response()->json([
            'data' => $this->normalize(DB::table('credit_card_debts')->where('id', $id)->first()),
            'message' => 'تمت إضافة البطاقة',
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $item = $this->findOwned($request, $id);
        if (! $item) {
            return response()->json(['message' => 'البطاقة غير موجودة'], 404);
        }

        $data = $this->validateData($request);

        DB::table('credit_card_debts')
            ->where('id', $id)
            ->update([
                'bank_name' => $data['bank_name'],
                'card_name' => $data['card_name'],
                'credit_limit' => $data['credit_limit'],
                'updated_at' => now(),
            ]);

        $this->syncVaultCardFromDebt($request, $id, $data);

        return response()->json([
            'data' => $this->normalize(DB::table('credit_card_debts')->where('id', $id)->first()),
            'message' => 'تم تحديث البطاقة',
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $item = $this->findOwned($request, $id);
        if (! $item) {
            return response()->json(['message' => 'البطاقة غير موجودة'], 404);
        }

        $this->unlinkVaultCard($request, $id, $item);
        DB::table('credit_card_debts')->where('id', $id)->delete();

        return response()->json(['message' => 'تم حذف البطاقة']);
    }

    private function validateData(Request $request): array
    {
        $data = $request->validate([
            'bank_name' => ['required', 'string', 'max:120'],
            'card_name' => ['required', 'string', 'max:120'],
            'credit_limit' => ['required', 'numeric', 'min:0.01', 'max:999999999999.99'],
        ]);

        return [
            'bank_name' => trim($data['bank_name']),
            'card_name' => trim($data['card_name']),
            'credit_limit' => round((float) $data['credit_limit'], 2),
        ];
    }

    private function syncAllDebtsToVault(Request $request): void
    {
        if (! Schema::hasTable('credit_card_debts') || ! Schema::hasTable('secure_vault_items')) {
            return;
        }

        $debts = DB::table('credit_card_debts')
            ->where('user_id', $this->userId($request))
            ->where('credit_limit', '>', 0)
            ->get();

        foreach ($debts as $debt) {
            $this->syncVaultCardFromDebt($request, (int) $debt->id, [
                'bank_name' => (string) $debt->bank_name,
                'card_name' => (string) $debt->card_name,
                'credit_limit' => round((float) $debt->credit_limit, 2),
            ]);
        }
    }

    private function syncVaultCardFromDebt(Request $request, int $debtId, array $data): void
    {
        if (! Schema::hasTable('secure_vault_items')) {
            return;
        }

        $userId = $this->userId($request);
        $debt = DB::table('credit_card_debts')
            ->where('id', $debtId)
            ->where('user_id', $userId)
            ->first();

        if (! $debt) {
            return;
        }

        $vaultId = $this->hasVaultLinkColumn() ? (int) ($debt->secure_vault_item_id ?? 0) : 0;
        $bankRef = $this->findOrCreateBankRef($userId, $data['bank_name']);
        $bankId = $bankRef ? (int) preg_replace('/\D+/', '', $bankRef) : 0;

        $vault = null;
        if ($vaultId > 0) {
            $vault = DB::table('secure_vault_items')
                ->where('id', $vaultId)
                ->where(function ($query) use ($userId) {
                    $query->whereNull('user_id')->orWhere('user_id', $userId);
                })
                ->first();
        }

        if (! $vault && Schema::hasColumn('secure_vault_items', 'credit_card_debt_id')) {
            $vault = DB::table('secure_vault_items')
                ->where('credit_card_debt_id', $debtId)
                ->where(function ($query) use ($userId) {
                    $query->whereNull('user_id')->orWhere('user_id', $userId);
                })
                ->first();
        }

        if (! $vault && $bankRef) {
            $candidateQuery = DB::table('secure_vault_items')
                ->where('category', 'cards')
                ->where('owner_group', $bankRef)
                ->where('title', $data['card_name'])
                ->where(function ($query) use ($userId) {
                    $query->whereNull('user_id')->orWhere('user_id', $userId);
                });

            if (Schema::hasColumn('secure_vault_items', 'card_type')) {
                $candidateQuery->where(function ($query) {
                    $query->whereNull('card_type')->orWhere('card_type', 'credit');
                });
            }

            $vault = $candidateQuery->first();
        }

        $updates = [
            'owner_group' => $bankRef,
            'category' => 'cards',
            'record_type' => 'card',
            'title' => $data['card_name'],
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('secure_vault_items', 'card_type')) {
            $updates['card_type'] = 'credit';
        }
        if (Schema::hasColumn('secure_vault_items', 'credit_card_debt_id')) {
            $updates['credit_card_debt_id'] = $debtId;
        }
        if ($bankId > 0 && Schema::hasColumn('secure_vault_items', 'parent_bank_id')) {
            $updates['parent_bank_id'] = $bankId;
        }

        if ($vault) {
            DB::table('secure_vault_items')->where('id', $vault->id)->update($updates);
            $vaultId = (int) $vault->id;
        } else {
            $create = array_merge($updates, [
                'user_id' => $userId,
                'is_favorite' => false,
                'created_at' => now(),
            ]);
            $vaultId = DB::table('secure_vault_items')->insertGetId($create);
        }

        if ($this->hasVaultLinkColumn() && (int) ($debt->secure_vault_item_id ?? 0) !== $vaultId) {
            DB::table('credit_card_debts')->where('id', $debtId)->update([
                'secure_vault_item_id' => $vaultId,
                'updated_at' => now(),
            ]);
        }
    }

    private function unlinkVaultCard(Request $request, int $debtId, object $debt): void
    {
        if (! Schema::hasTable('secure_vault_items') || ! Schema::hasColumn('secure_vault_items', 'credit_card_debt_id')) {
            return;
        }

        $userId = $this->userId($request);
        $vaultId = $this->hasVaultLinkColumn() ? (int) ($debt->secure_vault_item_id ?? 0) : 0;

        DB::table('secure_vault_items')
            ->where(function ($query) use ($debtId, $vaultId) {
                $query->where('credit_card_debt_id', $debtId);
                if ($vaultId > 0) {
                    $query->orWhere('id', $vaultId);
                }
            })
            ->where(function ($query) use ($userId) {
                $query->whereNull('user_id')->orWhere('user_id', $userId);
            })
            ->update([
                'credit_card_debt_id' => null,
                'updated_at' => now(),
            ]);
    }

    private function findOrCreateBankRef(int $userId, string $bankName): string
    {
        $existing = $this->findBankRef($userId, $bankName);
        if ($existing) {
            return $existing;
        }

        $values = [
            'user_id' => $userId,
            'owner_group' => null,
            'category' => 'banks',
            'record_type' => 'subscription',
            'is_favorite' => false,
            'title' => trim($bankName),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        $bankId = DB::table('secure_vault_items')->insertGetId($values);
        return 'bank:'.$bankId;
    }

    private function findBankRef(int $userId, string $bankName): ?string
    {
        $target = $this->normalizeBankName($bankName);
        if ($target === '') {
            return null;
        }

        $banks = DB::table('secure_vault_items')
            ->where('category', 'banks')
            ->where(function ($query) use ($userId) {
                $query->whereNull('user_id')->orWhere('user_id', $userId);
            })
            ->get(['id', 'title']);

        foreach ($banks as $bank) {
            $candidate = $this->normalizeBankName((string) $bank->title);
            if ($candidate === $target || str_contains($candidate, $target) || str_contains($target, $candidate)) {
                return 'bank:'.$bank->id;
            }
        }

        return null;
    }

    private function normalizeBankName(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $value = preg_replace('/^(بنك|البنك)\s+/u', '', $value) ?: $value;
        $value = str_replace(['أ', 'إ', 'آ', 'ة', 'ى'], ['ا', 'ا', 'ا', 'ه', 'ي'], $value);
        return preg_replace('/\s+/u', ' ', trim($value)) ?: '';
    }

    private function findOwned(Request $request, int $id): ?object
    {
        return DB::table('credit_card_debts')
            ->where('id', $id)
            ->where('user_id', $this->userId($request))
            ->first();
    }

    private function normalize(object $item): array
    {
        return [
            'id' => (int) $item->id,
            'user_id' => (int) $item->user_id,
            'secure_vault_item_id' => $this->hasVaultLinkColumn() ? ((int) ($item->secure_vault_item_id ?? 0) ?: null) : null,
            'linked_from_vault' => $this->hasVaultLinkColumn() && ! empty($item->secure_vault_item_id),
            'bank_name' => $item->bank_name,
            'card_name' => $item->card_name,
            'credit_limit' => round((float) $item->credit_limit, 2),
            'created_at' => $item->created_at,
            'updated_at' => $item->updated_at,
        ];
    }

    private function hasVaultLinkColumn(): bool
    {
        return Schema::hasTable('credit_card_debts') && Schema::hasColumn('credit_card_debts', 'secure_vault_item_id');
    }

    private function userId(Request $request): int
    {
        return (int) $request->attributes->get('ahmed_user_id');
    }
}
