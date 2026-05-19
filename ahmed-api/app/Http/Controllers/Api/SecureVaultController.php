<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SecureVaultController extends Controller
{
    private array $categories = ['banks', 'accounts', 'websites', 'other'];
    private array $types = ['login', 'card', 'note'];

    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $category = $request->query('category');
        $search = trim((string) $request->query('search', ''));

        $query = DB::table('secure_vault_items')
            ->when($userId, fn ($q) => $q->where(function ($nested) use ($userId) {
                $nested->whereNull('user_id')->orWhere('user_id', $userId);
            }))
            ->when($category && in_array($category, $this->categories, true), fn ($q) => $q->where('category', $category))
            ->when($search !== '', fn ($q) => $q->where(function ($nested) use ($search) {
                $nested->where('title', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhere('url', 'like', "%{$search}%")
                    ->orWhere('cardholder_name', 'like', "%{$search}%")
                    ->orWhere('card_brand', 'like', "%{$search}%")
                    ->orWhere('card_last_four', 'like', "%{$search}%");
            }))
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $query->map(fn ($item) => $this->present($item, false)),
            'meta' => [
                'categories' => $this->categoryOptions(),
                'types' => $this->typeOptions(),
            ],
        ]);
    }

    public function show(Request $request, int $id)
    {
        $item = $this->findItem($request, $id);
        if (! $item) {
            return response()->json(['message' => 'العنصر غير موجود'], 404);
        }

        return response()->json(['data' => $this->present($item, true)]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $cardDigits = $this->onlyDigits($data['card_number'] ?? '');

        $id = DB::table('secure_vault_items')->insertGetId([
            'user_id' => $this->userId($request),
            'category' => $data['category'],
            'record_type' => $data['record_type'],
            'title' => $data['title'],
            'username' => $data['username'] ?? null,
            'password_encrypted' => $this->encryptNullable($data['password'] ?? null),
            'url' => $data['url'] ?? null,
            'cardholder_name' => $data['cardholder_name'] ?? null,
            'card_brand' => $data['card_brand'] ?? null,
            'card_last_four' => $cardDigits ? substr($cardDigits, -4) : ($data['card_last_four'] ?? null),
            'expiry_month' => $data['expiry_month'] ?? null,
            'expiry_year' => $data['expiry_year'] ?? null,
            'notes_encrypted' => $this->encryptNullable($data['notes'] ?? null),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => $this->present($this->findItem($request, $id), true)], 201);
    }

    public function update(Request $request, int $id)
    {
        $item = $this->findItem($request, $id);
        if (! $item) {
            return response()->json(['message' => 'العنصر غير موجود'], 404);
        }

        $data = $this->validated($request);
        $cardDigits = $this->onlyDigits($data['card_number'] ?? '');

        DB::table('secure_vault_items')->where('id', $id)->update([
            'category' => $data['category'],
            'record_type' => $data['record_type'],
            'title' => $data['title'],
            'username' => $data['username'] ?? null,
            'password_encrypted' => $this->encryptNullable($data['password'] ?? null),
            'url' => $data['url'] ?? null,
            'cardholder_name' => $data['cardholder_name'] ?? null,
            'card_brand' => $data['card_brand'] ?? null,
            'card_last_four' => $cardDigits ? substr($cardDigits, -4) : ($data['card_last_four'] ?? null),
            'expiry_month' => $data['expiry_month'] ?? null,
            'expiry_year' => $data['expiry_year'] ?? null,
            'notes_encrypted' => $this->encryptNullable($data['notes'] ?? null),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => $this->present($this->findItem($request, $id), true)]);
    }

    public function destroy(Request $request, int $id)
    {
        $item = $this->findItem($request, $id);
        if (! $item) {
            return response()->json(['message' => 'العنصر غير موجود'], 404);
        }

        DB::table('secure_vault_items')->where('id', $id)->delete();

        return response()->json(['ok' => true, 'deleted_id' => $id]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'category' => ['required', Rule::in($this->categories)],
            'record_type' => ['required', Rule::in($this->types)],
            'title' => ['required', 'string', 'max:255'],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:2000'],
            'url' => ['nullable', 'string', 'max:255'],
            'cardholder_name' => ['nullable', 'string', 'max:255'],
            'card_brand' => ['nullable', 'string', 'max:255'],
            'card_number' => ['nullable', 'string', 'max:32'],
            'card_last_four' => ['nullable', 'string', 'max:4'],
            'expiry_month' => ['nullable', 'integer', 'between:1,12'],
            'expiry_year' => ['nullable', 'integer', 'between:2024,2100'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);
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

        return [
            'id' => $item->id,
            'user_id' => $item->user_id,
            'category' => $item->category,
            'category_label' => $this->categoryLabel($item->category),
            'record_type' => $item->record_type,
            'record_type_label' => $this->typeLabel($item->record_type),
            'title' => $item->title,
            'username' => $item->username,
            'password' => $revealSecrets ? $this->decryptNullable($item->password_encrypted) : null,
            'has_password' => ! empty($item->password_encrypted),
            'url' => $item->url,
            'cardholder_name' => $item->cardholder_name,
            'card_brand' => $item->card_brand,
            'card_last_four' => $item->card_last_four,
            'expiry_month' => $item->expiry_month,
            'expiry_year' => $item->expiry_year,
            'notes' => $revealSecrets ? $this->decryptNullable($item->notes_encrypted) : null,
            'has_notes' => ! empty($item->notes_encrypted),
            'created_at' => $item->created_at,
            'updated_at' => $item->updated_at,
        ];
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

    private function categoryOptions(): array
    {
        return collect($this->categories)->map(fn ($value) => ['value' => $value, 'label' => $this->categoryLabel($value)])->values()->all();
    }

    private function typeOptions(): array
    {
        return collect($this->types)->map(fn ($value) => ['value' => $value, 'label' => $this->typeLabel($value)])->values()->all();
    }

    private function categoryLabel(string $value): string
    {
        return match ($value) {
            'banks' => 'بنوك',
            'accounts' => 'حسابات',
            'websites' => 'مواقع',
            default => 'أخرى',
        };
    }

    private function typeLabel(string $value): string
    {
        return match ($value) {
            'card' => 'بطاقة',
            'note' => 'ملاحظة',
            default => 'دخول',
        };
    }
}
