<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SecureVaultController extends Controller
{
    private array $categories = ['banks', 'accounts', 'websites', 'cards', 'subscriptions', 'other'];
    private array $types = ['login', 'card', 'subscription'];

    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $category = $request->query('category');
        $search = trim((string) $request->query('search', ''));

        $items = DB::table('secure_vault_items')
            ->when($userId, fn ($q) => $q->where(function ($nested) use ($userId) {
                $nested->whereNull('user_id')->orWhere('user_id', $userId);
            }))
            ->when($category && in_array($category, $this->categories, true), fn ($q) => $q->where('category', $category))
            ->when($search !== '', fn ($q) => $q->where(function ($nested) use ($search) {
                $nested->where('title', 'like', "%{$search}%")
                    ->orWhere('url', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('purpose', 'like', "%{$search}%")
                    ->orWhere('tags', 'like', "%{$search}%")
                    ->orWhere('owner_group', 'like', "%{$search}%")
                    ->orWhere('cardholder_name', 'like', "%{$search}%")
                    ->orWhere('card_brand', 'like', "%{$search}%")
                    ->orWhere('card_last_four', 'like', "%{$search}%");
            }))
            ->orderByDesc('is_favorite')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $items->map(fn ($item) => $this->present($item, false)),
            'meta' => $this->meta(),
        ]);
    }

    public function show(Request $request, int $id)
    {
        $item = $this->findItem($request, $id);
        if (! $item) {
            return response()->json(['message' => 'العنصر غير موجود'], 404);
        }

        DB::table('secure_vault_items')->where('id', $id)->update(['last_viewed_at' => now()]);

        return response()->json(['data' => $this->present($this->findItem($request, $id), true)]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $this->validateBankLoginRule($data);
        $this->validateCardLink($data);
        $cardDigits = $this->onlyDigits($data['card_number'] ?? '');
        $cardType = $data['card_type'] ?? null;

        $id = DB::transaction(function () use ($request, $data, $cardDigits, $cardType) {
            $id = DB::table('secure_vault_items')->insertGetId([
                'user_id' => $this->userId($request),
                'owner_group' => $data['owner_group'] ?? null,
                'category' => $data['category'],
                'record_type' => $data['record_type'],
                'is_favorite' => (bool) ($data['is_favorite'] ?? false),
                'title' => $data['title'],
                'username' => null,
                'username_encrypted' => $this->encryptNullable($data['username'] ?? null),
                'password_encrypted' => $this->encryptNullable($data['password'] ?? null),
                'url' => $data['url'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'purpose' => $data['purpose'] ?? null,
                'tags' => $data['tags'] ?? null,
                'cardholder_name' => $data['cardholder_name'] ?? null,
                'card_brand' => $cardType === 'mada' ? 'mada' : ($data['card_brand'] ?? null),
                'card_type' => $cardType,
                'card_number_encrypted' => $this->encryptNullable($cardDigits ?: ($data['card_number'] ?? null)),
                'card_last_four' => $cardDigits ? substr($cardDigits, -4) : ($data['card_last_four'] ?? null),
                'card_cvv_encrypted' => $this->encryptNullable($data['card_cvv'] ?? null),
                'expiry_month' => $data['expiry_month'] ?? null,
                'expiry_year' => $data['expiry_year'] ?? null,
                'statement_day' => $cardType === 'credit' ? ($data['statement_day'] ?? null) : null,
                'credit_card_debt_id' => $cardType === 'credit' ? ($data['credit_card_debt_id'] ?? null) : null,
                'sadad_number_encrypted' => $cardType === 'credit' ? $this->encryptNullable($data['sadad_number'] ?? null) : null,
                'security_question_encrypted' => $this->encryptNullable($data['security_question'] ?? null),
                'security_answer_encrypted' => $this->encryptNullable($data['security_answer'] ?? null),
                'backup_codes_encrypted' => $this->encryptNullable($data['backup_codes'] ?? null),
                'notes_encrypted' => $this->encryptNullable($data['notes'] ?? null),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($data['record_type'] === 'card' || $data['category'] === 'cards') {
                $this->syncCreditDebtForVaultCard($request, $id, $data);
            }

            return $id;
        });

        return response()->json(['data' => $this->present($this->findItem($request, $id), true)], 201);
    }

    public function update(Request $request, int $id)
    {
        $item = $this->findItem($request, $id);
        if (! $item) {
            return response()->json(['message' => 'العنصر غير موجود'], 404);
        }

        $data = $this->validated($request);

        if (($item->category ?? null) === 'banks') {
            $data['category'] = 'banks';
            $data['record_type'] = 'subscription';
            $data['owner_group'] = null;
        }

        $this->validateBankLoginRule($data);
        $this->validateCardLink($data);
        $cardDigits = $this->onlyDigits($data['card_number'] ?? '');
        $cardType = $data['card_type'] ?? null;

        DB::transaction(function () use ($request, $id, $data, $cardDigits, $cardType) {
            DB::table('secure_vault_items')->where('id', $id)->update([
                'owner_group' => $data['owner_group'] ?? null,
                'category' => $data['category'],
                'record_type' => $data['record_type'],
                'is_favorite' => (bool) ($data['is_favorite'] ?? false),
                'title' => $data['title'],
                'username' => null,
                'username_encrypted' => $this->encryptNullable($data['username'] ?? null),
                'password_encrypted' => $this->encryptNullable($data['password'] ?? null),
                'url' => $data['url'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'purpose' => $data['purpose'] ?? null,
                'tags' => $data['tags'] ?? null,
                'cardholder_name' => $data['cardholder_name'] ?? null,
                'card_brand' => $cardType === 'mada' ? 'mada' : ($data['card_brand'] ?? null),
                'card_type' => $cardType,
                'card_number_encrypted' => $this->encryptNullable($cardDigits ?: ($data['card_number'] ?? null)),
                'card_last_four' => $cardDigits ? substr($cardDigits, -4) : ($data['card_last_four'] ?? null),
                'card_cvv_encrypted' => $this->encryptNullable($data['card_cvv'] ?? null),
                'expiry_month' => $data['expiry_month'] ?? null,
                'expiry_year' => $data['expiry_year'] ?? null,
                'statement_day' => $cardType === 'credit' ? ($data['statement_day'] ?? null) : null,
                'credit_card_debt_id' => $cardType === 'credit' ? ($data['credit_card_debt_id'] ?? null) : null,
                'sadad_number_encrypted' => $cardType === 'credit' ? $this->encryptNullable($data['sadad_number'] ?? null) : null,
                'security_question_encrypted' => $this->encryptNullable($data['security_question'] ?? null),
                'security_answer_encrypted' => $this->encryptNullable($data['security_answer'] ?? null),
                'backup_codes_encrypted' => $this->encryptNullable($data['backup_codes'] ?? null),
                'notes_encrypted' => $this->encryptNullable($data['notes'] ?? null),
                'updated_at' => now(),
            ]);

            if ($data['record_type'] === 'card' || $data['category'] === 'cards') {
                $this->syncCreditDebtForVaultCard($request, $id, $data);
            }
        });

        return response()->json(['data' => $this->present($this->findItem($request, $id), true)]);
    }

    public function destroy(Request $request, int $id)
    {
        $item = $this->findItem($request, $id);
        if (! $item) {
            return response()->json(['message' => 'العنصر غير موجود'], 404);
        }

        DB::transaction(function () use ($request, $item, $id) {
            if (($item->record_type ?? null) === 'card' || ($item->category ?? null) === 'cards') {
                $this->deleteLinkedDebt($request, $item);
            }
            DB::table('secure_vault_items')->where('id', $id)->delete();
        });

        return response()->json(['ok' => true, 'deleted_id' => $id]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'owner_group' => ['nullable', 'string', 'max:80'],
            'category' => ['required', Rule::in($this->categories)],
            'record_type' => ['required', Rule::in($this->types)],
            'is_favorite' => ['nullable', 'boolean'],
            'title' => ['required', 'string', 'max:255'],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:2000'],
            'url' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'tags' => ['nullable', 'string', 'max:255'],
            'cardholder_name' => ['nullable', 'string', 'max:255'],
            'card_brand' => ['nullable', Rule::in(['visa', 'mastercard', 'mada'])],
            'card_type' => ['nullable', Rule::in(['mada', 'credit'])],
            'card_number' => ['nullable', 'string', 'max:40'],
            'card_last_four' => ['nullable', 'string', 'max:4'],
            'card_cvv' => ['nullable', 'string', 'max:10'],
            'expiry_month' => ['nullable', 'integer', 'between:1,12'],
            'expiry_year' => ['nullable', 'integer', 'between:2024,2100'],
            'statement_day' => ['nullable', 'integer', 'between:1,31'],
            'credit_card_debt_id' => ['nullable', 'integer', 'min:1'],
            'credit_balance' => ['nullable', 'numeric', 'min:0', 'max:999999999999.99'],
            'sadad_number' => ['nullable', 'string', 'max:255'],
            'security_question' => ['nullable', 'string', 'max:1000'],
            'security_answer' => ['nullable', 'string', 'max:1000'],
            'backup_codes' => ['nullable', 'string', 'max:4000'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);
    }

    private function validateBankLoginRule(array $data): void
    {
        if (($data['record_type'] ?? null) !== 'login' || ($data['category'] ?? null) !== 'websites') {
            return;
        }

        $ownerGroup = trim((string) ($data['owner_group'] ?? ''));
        if ($ownerGroup !== '' && $ownerGroup !== 'sites') {
            throw ValidationException::withMessages([
                'owner_group' => ['لكل بنك بيانات دخول واحدة فقط. عدّل بيانات دخول البنك الأساسية بدل إضافة دخول آخر.'],
            ]);
        }
    }

    private function validateCardLink(array $data): void
    {
        if (($data['record_type'] ?? null) !== 'card' && ($data['category'] ?? null) !== 'cards') {
            return;
        }

        if (empty($data['card_type'])) {
            throw ValidationException::withMessages(['card_type' => ['حدد نوع البطاقة: مدى أو ائتمانية.']]);
        }

        if (($data['card_type'] ?? null) === 'credit') {
            if (! in_array($data['card_brand'] ?? null, ['visa', 'mastercard'], true)) {
                throw ValidationException::withMessages(['card_brand' => ['حدد Visa أو Mastercard.']]);
            }
            if (empty($data['statement_day'])) {
                throw ValidationException::withMessages(['statement_day' => ['حدد تاريخ كشف البطاقة.']]);
            }
        }
    }

    private function syncCreditDebtForVaultCard(Request $request, int $vaultId, array $data): void
    {
        if (! Schema::hasTable('credit_card_debts')) {
            return;
        }

        $userId = (int) $this->userId($request);
        $vault = DB::table('secure_vault_items')->where('id', $vaultId)->first();
        if (! $vault) {
            return;
        }

        $existingDebt = $this->linkedDebtForVault($userId, $vault, $data['credit_card_debt_id'] ?? null);
        $hasBalance = array_key_exists('credit_balance', $data) && $data['credit_balance'] !== null && $data['credit_balance'] !== '';
        $balance = $hasBalance
            ? round((float) $data['credit_balance'], 2)
            : ($existingDebt ? round((float) $existingDebt->credit_limit, 2) : 0.0);

        if (($data['card_type'] ?? null) !== 'credit' || $balance <= 0) {
            if ($existingDebt) {
                DB::table('credit_card_debts')
                    ->where('id', $existingDebt->id)
                    ->where('user_id', $userId)
                    ->delete();
            }
            DB::table('secure_vault_items')->where('id', $vaultId)->update([
                'credit_card_debt_id' => null,
                'updated_at' => now(),
            ]);
            return;
        }

        $bankName = $this->resolveBankName($request, (string) ($data['owner_group'] ?? $vault->owner_group ?? ''));
        $values = [
            'user_id' => $userId,
            'bank_name' => $bankName,
            'card_name' => trim((string) ($data['title'] ?? $vault->title ?? 'بطاقة ائتمانية')),
            'credit_limit' => $balance,
            'updated_at' => now(),
        ];

        if ($this->hasDebtVaultLinkColumn()) {
            $values['secure_vault_item_id'] = $vaultId;
        }

        if ($existingDebt) {
            DB::table('credit_card_debts')
                ->where('id', $existingDebt->id)
                ->where('user_id', $userId)
                ->update($values);
            $debtId = (int) $existingDebt->id;
        } else {
            $values['created_at'] = now();
            $debtId = DB::table('credit_card_debts')->insertGetId($values);
        }

        DB::table('secure_vault_items')->where('id', $vaultId)->update([
            'credit_card_debt_id' => $debtId,
            'updated_at' => now(),
        ]);
    }

    private function linkedDebtForVault(int $userId, object $vault, $requestedDebtId = null): ?object
    {
        $query = DB::table('credit_card_debts')->where('user_id', $userId);

        if ($this->hasDebtVaultLinkColumn()) {
            $byVault = (clone $query)->where('secure_vault_item_id', $vault->id)->first();
            if ($byVault) {
                return $byVault;
            }
        }

        $debtId = (int) ($requestedDebtId ?: ($vault->credit_card_debt_id ?? 0));
        return $debtId > 0 ? (clone $query)->where('id', $debtId)->first() : null;
    }

    private function deleteLinkedDebt(Request $request, object $vault): void
    {
        if (! Schema::hasTable('credit_card_debts')) {
            return;
        }

        $userId = (int) $this->userId($request);
        $query = DB::table('credit_card_debts')->where('user_id', $userId);
        $debtId = (int) ($vault->credit_card_debt_id ?? 0);

        if ($this->hasDebtVaultLinkColumn()) {
            $query->where(function ($nested) use ($vault, $debtId) {
                $nested->where('secure_vault_item_id', $vault->id);
                if ($debtId > 0) {
                    $nested->orWhere('id', $debtId);
                }
            });
        } elseif ($debtId > 0) {
            $query->where('id', $debtId);
        } else {
            return;
        }

        $query->delete();
    }

    private function resolveBankName(Request $request, string $ownerGroup): string
    {
        $ownerGroup = trim($ownerGroup);
        $bankId = (int) preg_replace('/\D+/', '', $ownerGroup);
        $userId = $this->userId($request);

        if ($bankId > 0) {
            $bank = DB::table('secure_vault_items')
                ->where('id', $bankId)
                ->where('category', 'banks')
                ->when($userId, fn ($q) => $q->where(function ($nested) use ($userId) {
                    $nested->whereNull('user_id')->orWhere('user_id', $userId);
                }))
                ->first(['title']);
            if ($bank && trim((string) $bank->title) !== '') {
                return trim((string) $bank->title);
            }
        }

        $fallback = preg_replace('/^bank:/i', '', $ownerGroup) ?: $ownerGroup;
        return trim($fallback) !== '' ? trim($fallback) : 'البنك';
    }

    private function findItem(Request $request, int $id): ?object
    {
        $userId = $this->userId($request);

        return DB::table('secure_vault_items')
            ->where('id', $id)
            ->when($userId, fn ($q) => $q->where(function ($nested) use ($userId) {
                $nested->whereNull('user_id')->orWhere('user_id', $userId);
            }))
            ->first();
    }

    private function present(?object $item, bool $revealSecrets): ?array
    {
        if (! $item) {
            return null;
        }

        $encryptedUsername = $item->username_encrypted ?? null;
        $legacyUsername = $item->username ?? null;
        $debt = (($item->record_type ?? null) === 'card' || ($item->category ?? null) === 'cards')
            ? $this->presentDebtForVault($item)
            : null;

        return [
            'id' => $item->id,
            'user_id' => $item->user_id,
            'owner_group' => $item->owner_group,
            'category' => $item->category,
            'category_label' => $this->categoryLabel($item->category),
            'record_type' => $item->record_type,
            'record_type_label' => $this->typeLabel($item->record_type),
            'is_favorite' => (bool) $item->is_favorite,
            'title' => $item->title,
            'username' => $item->category === 'accounts'
                ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername)
                : ($revealSecrets ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername) : null),
            'iban' => $item->category === 'accounts' ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername) : null,
            'has_username' => ! empty($encryptedUsername) || ! empty($legacyUsername),
            'password' => $revealSecrets ? $this->decryptNullable($item->password_encrypted) : null,
            'has_password' => ! empty($item->password_encrypted),
            'url' => $item->url,
            'email' => $item->email,
            'phone' => $item->phone,
            'purpose' => $item->purpose,
            'account_number' => $item->category === 'accounts' ? $item->purpose : null,
            'tags' => $item->tags,
            'cardholder_name' => $item->cardholder_name,
            'card_brand' => $item->card_brand,
            'card_type' => $item->card_type ?? null,
            'card_number' => $revealSecrets ? $this->decryptNullable($item->card_number_encrypted) : null,
            'has_card_number' => ! empty($item->card_number_encrypted),
            'card_last_four' => $item->card_last_four,
            'card_cvv' => $revealSecrets ? $this->decryptNullable($item->card_cvv_encrypted) : null,
            'has_card_cvv' => ! empty($item->card_cvv_encrypted),
            'expiry_month' => $item->expiry_month,
            'expiry_year' => $item->expiry_year,
            'statement_day' => $item->statement_day ?? null,
            'credit_card_debt_id' => $item->credit_card_debt_id ?? ($debt->id ?? null),
            'credit_balance' => $debt ? round((float) $debt->credit_limit, 2) : 0,
            'is_in_credit_debt' => (bool) $debt,
            'sadad_number' => $revealSecrets ? $this->decryptNullable($item->sadad_number_encrypted ?? null) : null,
            'has_sadad_number' => ! empty($item->sadad_number_encrypted ?? null),
            'security_question' => $revealSecrets ? $this->decryptNullable($item->security_question_encrypted) : null,
            'security_answer' => $revealSecrets ? $this->decryptNullable($item->security_answer_encrypted) : null,
            'backup_codes' => $revealSecrets ? $this->decryptNullable($item->backup_codes_encrypted) : null,
            'notes' => $revealSecrets ? $this->decryptNullable($item->notes_encrypted) : null,
            'has_notes' => ! empty($item->notes_encrypted),
            'last_viewed_at' => $item->last_viewed_at,
            'created_at' => $item->created_at,
            'updated_at' => $item->updated_at,
        ];
    }

    private function presentDebtForVault(object $item): ?object
    {
        if (! Schema::hasTable('credit_card_debts')) {
            return null;
        }

        if ($this->hasDebtVaultLinkColumn()) {
            $debt = DB::table('credit_card_debts')->where('secure_vault_item_id', $item->id)->first();
            if ($debt) {
                return $debt;
            }
        }

        $debtId = (int) ($item->credit_card_debt_id ?? 0);
        return $debtId > 0 ? DB::table('credit_card_debts')->where('id', $debtId)->first() : null;
    }

    private function hasDebtVaultLinkColumn(): bool
    {
        return Schema::hasTable('credit_card_debts') && Schema::hasColumn('credit_card_debts', 'secure_vault_item_id');
    }

    private function userId(Request $request): ?int
    {
        return $request->attributes->get('ahmed_user_id') ?: (int) $request->header('X-Ahmed-User-Id') ?: null;
    }

    private function encryptNullable(?string $value): ?string
    {
        $value = trim((string) $value);
        return $value === '' ? null : Crypt::encryptString($value);
    }

    private function decryptNullable(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function onlyDigits(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?: '';
    }

    private function meta(): array
    {
        return [
            'categories' => collect($this->categories)->map(fn ($value) => ['value' => $value, 'label' => $this->categoryLabel($value)])->values()->all(),
            'types' => collect($this->types)->map(fn ($value) => ['value' => $value, 'label' => $this->typeLabel($value)])->values()->all(),
        ];
    }

    private function categoryLabel(string $value): string
    {
        return match ($value) {
            'banks' => 'بنوك',
            'accounts' => 'حسابات',
            'websites' => 'مواقع',
            'cards' => 'بطاقات',
            'subscriptions' => 'اشتراكات',
            default => 'أخرى',
        };
    }

    private function typeLabel(string $value): string
    {
        return match ($value) {
            'card' => 'بطاقة',
            'subscription' => 'اشتراك',
            default => 'دخول',
        };
    }
}
