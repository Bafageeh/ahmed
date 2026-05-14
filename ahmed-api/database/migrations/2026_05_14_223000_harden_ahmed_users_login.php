<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'username')) {
                $table->string('username', 80)->nullable()->unique()->after('name');
            }
            if (! Schema::hasColumn('users', 'is_admin')) {
                $table->boolean('is_admin')->default(false)->after('password');
            }
            if (! Schema::hasColumn('users', 'remember_token')) {
                $table->rememberToken();
            }
        });

        $users = DB::table('users')->orderBy('id')->get(['id', 'name', 'email']);
        $firstId = (int) ($users->first()->id ?? 0);

        foreach ($users as $user) {
            $username = $this->safeUsername($user->email ?: $user->name ?: ('user' . $user->id), (int) $user->id);
            DB::table('users')
                ->where('id', $user->id)
                ->update([
                    'username' => DB::raw("COALESCE(username, '" . str_replace("'", "''", $username) . "')"),
                    'is_admin' => ((int) $user->id === $firstId),
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        // لا نحذف الأعمدة حتى لا نخسر حسابات الدخول أو حالة المدير.
    }

    private function safeUsername(string $value, int $id): string
    {
        $base = Str::of($value)
            ->before('@')
            ->replaceMatches('/[^A-Za-z0-9_.-]+/', '_')
            ->trim('_.-')
            ->lower()
            ->limit(55, '')
            ->toString();

        return ($base !== '' ? $base : 'user') . '_' . $id;
    }
};
