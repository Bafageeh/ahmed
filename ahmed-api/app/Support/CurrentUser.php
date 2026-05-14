<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class CurrentUser
{
    public static function id(?Request $request = null): int
    {
        $request = $request ?: request();
        $token = self::bearerToken($request);

        if ($token && Schema::hasTable('api_tokens')) {
            $hash = hash('sha256', $token);
            $record = DB::table('api_tokens')
                ->where('token_hash', $hash)
                ->whereNull('revoked_at')
                ->first();

            if ($record) {
                DB::table('api_tokens')->where('id', $record->id)->update(['last_used_at' => now()]);
                return (int) $record->user_id;
            }
        }

        return self::defaultUserId();
    }

    public static function defaultUserId(): int
    {
        if (! Schema::hasTable('users')) {
            return 1;
        }

        $id = DB::table('users')->orderBy('id')->value('id');
        if ($id) {
            return (int) $id;
        }

        return (int) DB::table('users')->insertGetId([
            'name' => 'المستخدم الأساسي',
            'email' => 'owner@ahmed.local',
            'password' => Hash::make(Str::random(32)),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public static function user(?Request $request = null): ?object
    {
        $id = self::id($request);
        return Schema::hasTable('users') ? DB::table('users')->where('id', $id)->first() : null;
    }

    private static function bearerToken(Request $request): ?string
    {
        $header = (string) $request->header('Authorization', '');
        if (preg_match('/Bearer\s+(.+)/i', $header, $matches)) {
            return trim($matches[1]);
        }

        return null;
    }
}
