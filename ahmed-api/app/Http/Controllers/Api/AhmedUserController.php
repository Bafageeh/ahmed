<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AhmedUserController extends Controller
{
    public function index(Request $request)
    {
        $this->ensureAdmin($request);

        return response()->json([
            'data' => DB::table('users')
                ->select($this->userSelect())
                ->orderBy('id')
                ->get()
                ->map(fn ($user) => $this->publicUser($user)),
        ]);
    }

    public function store(Request $request)
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'username' => ['required', 'string', 'max:80'],
            'password' => ['required', 'string', 'min:4', 'max:100'],
            'is_admin' => ['nullable', 'boolean'],
        ]);

        $username = trim($data['username']);
        if (Schema::hasColumn('users', 'username') && DB::table('users')->where('username', $username)->exists()) {
            return response()->json(['message' => 'اسم المستخدم مستخدم سابقًا'], 422);
        }

        $insert = [
            'name' => trim($data['name']),
            'email' => 'user-' . time() . '-' . Str::lower(Str::random(8)) . '@ahmed.local',
            'password' => Hash::make($data['password']),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('users', 'username')) {
            $insert['username'] = $username;
        }
        if (Schema::hasColumn('users', 'is_admin')) {
            $insert['is_admin'] = (bool) ($data['is_admin'] ?? false);
        }

        $id = DB::table('users')->insertGetId($insert);

        return response()->json([
            'data' => $this->publicUser(DB::table('users')->select($this->userSelect())->where('id', $id)->first()),
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $this->ensureAdmin($request);

        $user = DB::table('users')->where('id', $id)->first();
        if (! $user) {
            return response()->json(['message' => 'المستخدم غير موجود'], 404);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'username' => ['required', 'string', 'max:80'],
            'password' => ['nullable', 'string', 'min:4', 'max:100'],
            'is_admin' => ['nullable', 'boolean'],
        ]);

        $username = trim($data['username']);
        if (Schema::hasColumn('users', 'username') && DB::table('users')->where('username', $username)->where('id', '!=', $id)->exists()) {
            return response()->json(['message' => 'اسم المستخدم مستخدم سابقًا'], 422);
        }

        $update = [
            'name' => trim($data['name']),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('users', 'username')) {
            $update['username'] = $username;
        }
        if (Schema::hasColumn('users', 'is_admin') && array_key_exists('is_admin', $data)) {
            $update['is_admin'] = (bool) $data['is_admin'];
        }
        if (! empty($data['password'])) {
            $update['password'] = Hash::make($data['password']);
            if (Schema::hasColumn('users', 'remember_token')) {
                $update['remember_token'] = null;
            }
        }

        DB::table('users')->where('id', $id)->update($update);

        return response()->json([
            'data' => $this->publicUser(DB::table('users')->select($this->userSelect())->where('id', $id)->first()),
        ]);
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->attributes->get('ahmed_user');
        $isAdmin = Schema::hasColumn('users', 'is_admin')
            ? (bool) ($user->is_admin ?? false)
            : ((int) ($user->id ?? 0) === (int) (DB::table('users')->orderBy('id')->value('id') ?: 0));

        abort_unless($isAdmin, 403, 'هذه الشاشة للمدير فقط');
    }

    private function publicUser($user): array
    {
        return [
            'id' => (int) ($user->id ?? 0),
            'name' => (string) ($user->name ?? ''),
            'username' => (string) ($user->username ?? ''),
            'is_admin' => Schema::hasColumn('users', 'is_admin') ? (bool) ($user->is_admin ?? false) : false,
            'created_at' => $user->created_at ?? null,
            'updated_at' => $user->updated_at ?? null,
        ];
    }

    private function userSelect(): array
    {
        $fields = ['id', 'name', 'created_at', 'updated_at'];
        if (Schema::hasColumn('users', 'username')) {
            $fields[] = 'username';
        }
        if (Schema::hasColumn('users', 'is_admin')) {
            $fields[] = 'is_admin';
        }
        return $fields;
    }
}
