<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users') || Schema::hasColumn('users', 'username')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 80)->nullable()->unique()->after('name');
        });

        DB::table('users')->orderBy('id')->get(['id', 'name', 'email'])->each(function ($user) {
            $base = Str::of($user->name ?: ($user->email ?: 'user-' . $user->id))
                ->lower()
                ->replaceMatches('/[^a-z0-9_\-\x{0600}-\x{06FF}]+/u', '_')
                ->trim('_')
                ->toString();

            $base = $base !== '' ? $base : 'user_' . $user->id;
            $username = $base;
            $counter = 1;

            while (DB::table('users')->where('username', $username)->where('id', '!=', $user->id)->exists()) {
                $username = $base . '_' . $counter;
                $counter++;
            }

            DB::table('users')->where('id', $user->id)->update(['username' => $username]);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'username')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropColumn('username');
        });
    }
};
