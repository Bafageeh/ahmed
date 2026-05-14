<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AhmedUserController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => DB::table('users')
                ->select(['id', 'name', 'email', 'created_at', 'updated_at'])
                ->orderBy('id')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190'],
        ]);

        $email = strtolower(trim($data['email'] ?? ''));
        if ($email === '') {
            $email = 'user-' . time() . '-' . Str::lower(Str::random(6)) . '@ahmed.local';
        }

        if (DB::table('users')->where('email', $email)->exists()) {
            return response()->json(['message' => 'هذا البريد مستخدم سابقًا'], 422);
        }

        $id = DB::table('users')->insertGetId([
            'name' => trim($data['name']),
            'email' => $email,
            'password' => Hash::make(Str::random(32)),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('users')
                ->select(['id', 'name', 'email', 'created_at', 'updated_at'])
                ->where('id', $id)
                ->first(),
        ], 201);
    }
}
