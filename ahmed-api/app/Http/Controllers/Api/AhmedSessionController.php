<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AhmedSessionController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:80'],
            'password' => ['required', 'string', 'max:100'],
        ]);

        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'remember_token')) {
            return response()->json(['message' => 'قاعدة البيانات تحتاج تحديث تسجيل الدخول'], 503);
        }

        $username = trim($data['username']);
        $query = DB::table('users');
        if (Schema::hasColumn('users', 'username')) {
            $query->where('username', $username);
        } else {
            $query->where('email', $username);
        }

        $user = $query->first();
        if (! $user || ! Hash::check((string) $data['password'], (string) $user->password)) {
            return response()->json(['message' => 'اسم المستخدم أو الرقم السري غير صحيح'], 422);
        }

        $sessionKey = Str::random(80);
        DB::table('users')->where('id', $user->id)->update([
            'remember_token' => hash('sha256', $sessionKey),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => $this->publicUser(DB::table('users')->where('id', $user->id)->first()),
            'session_key' => $sessionKey,
        ]);
    }

    public function show(Request $request)
    {
        return response()->json([
            'data' => $this->publicUser($request->attributes->get('ahmed_user')),
        ]);
    }

    public function destroy(Request $request)
    {
        $userId = (int) $request->attributes->get('ahmed_user_id', 0);
        if ($userId > 0 && Schema::hasColumn('users', 'remember_token')) {
            DB::table('users')->where('id', $userId)->update([
                'remember_token' => null,
                'updated_at' => now(),
            ]);
        }

        return response()->json(['message' => 'تم تسجيل الخروج']);
    }

    private function publicUser($user): array
    {
        return [
            'id' => (int) ($user->id ?? 0),
            'name' => (string) ($user->name ?? ''),
            'username' => (string) ($user->username ?? ''),
            'is_admin' => Schema::hasColumn('users', 'is_admin') ? (bool) ($user->is_admin ?? false) : false,
        ];
    }
}
