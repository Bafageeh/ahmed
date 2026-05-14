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
    public function index()
    {
        return response()->json([
            'data' => DB::table('users')
                ->select($this->userSelect())
                ->orderBy('id')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'username' => ['required', 'string', 'max:80'],
            'password' => ['required', 'string', 'min:4', 'max:100'],
        ]);

        $username = trim($data['username']);
        if (Schema::hasColumn('users', 'username') && DB::table('users')->where('username', $username)->exists()) {
            return response()->json(['message' => 'اسم المستخدم مستخدم سابقًا'], 422);
        }

        $email = 'user-' . time() . '-' . Str::lower(Str::random(8)) . '@ahmed.local';

        $insert = [
            'name' => trim($data['name']),
            'email' => $email,
            'password' => Hash::make($data['password']),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('users', 'username')) {
            $insert['username'] = $username;
        }

        $id = DB::table('users')->insertGetId($insert);

        return response()->json([
            'data' => DB::table('users')
                ->select($this->userSelect())
                ->where('id', $id)
                ->first(),
        ], 201);
    }

    private function userSelect(): array
    {
        $fields = ['id', 'name', 'created_at', 'updated_at'];
        if (Schema::hasColumn('users', 'username')) {
            $fields[] = 'username';
        }
        return $fields;
    }
}
