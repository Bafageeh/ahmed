<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class AhmedAuthenticate
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = trim((string) ($request->bearerToken() ?: $request->header('X-Ahmed-Token', '')));

        if ($token === '' || ! Schema::hasTable('users') || ! Schema::hasColumn('users', 'remember_token')) {
            return response()->json(['message' => 'يجب تسجيل الدخول أولاً'], 401);
        }

        $fields = ['id', 'name', 'email', 'password', 'remember_token'];
        if (Schema::hasColumn('users', 'username')) {
            $fields[] = 'username';
        }
        if (Schema::hasColumn('users', 'is_admin')) {
            $fields[] = 'is_admin';
        }

        $users = DB::table('users')
            ->select($fields)
            ->whereNotNull('remember_token')
            ->orderBy('id')
            ->get();

        foreach ($users as $user) {
            $storedToken = (string) ($user->remember_token ?? '');
            if ($storedToken !== '' && Hash::check($token, $storedToken)) {
                $request->headers->set('X-Ahmed-User-Id', (string) $user->id);
                $request->attributes->set('ahmed_user_id', (int) $user->id);
                $request->attributes->set('ahmed_user', $user);

                return $next($request);
            }
        }

        return response()->json(['message' => 'انتهت الجلسة أو بيانات الدخول غير صحيحة'], 401);
    }
}
