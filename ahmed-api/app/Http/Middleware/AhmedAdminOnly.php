<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class AhmedAdminOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('ahmed_user');
        $userId = (int) ($request->attributes->get('ahmed_user_id') ?: ($user->id ?? 0));

        $isAdmin = Schema::hasColumn('users', 'is_admin')
            ? (bool) ($user->is_admin ?? false)
            : ($userId > 0 && $userId === (int) (DB::table('users')->orderBy('id')->value('id') ?: 0));

        if (! $isAdmin) {
            return response()->json([
                'message' => 'هذه البيانات مرتبطة بحساب المدير وليست متاحة لهذا المستخدم',
            ], 403);
        }

        return $next($request);
    }
}
