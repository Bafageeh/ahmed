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
        $defaultUserId = $this->defaultUserId();

        $this->addUserId('investment_platforms', $defaultUserId);
        $this->addUserId('investment_accounts', $defaultUserId);
        $this->addUserId('investment_investors', $defaultUserId);
        $this->addUserId('investment_opportunities', $defaultUserId);
        $this->addUserId('investment_opportunity_allocations', $defaultUserId);
        $this->addUserId('ta3meed_receipts', $defaultUserId);
        $this->addUserId('ta3meed_receipt_allocations', $defaultUserId);
        $this->addUserId('ta3meed_investor_account_entries', $defaultUserId);
        $this->addUserId('income_sources', $defaultUserId);
        $this->addUserId('linked_income_sources', $defaultUserId);
        $this->addUserId('whatsapp_messages', $defaultUserId);

        $this->createApiTokens();
    }

    public function down(): void
    {
        Schema::dropIfExists('api_tokens');

        foreach ([
            'whatsapp_messages',
            'linked_income_sources',
            'income_sources',
            'ta3meed_investor_account_entries',
            'ta3meed_receipt_allocations',
            'ta3meed_receipts',
            'investment_opportunity_allocations',
            'investment_opportunities',
            'investment_investors',
            'investment_accounts',
            'investment_platforms',
        ] as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'user_id')) {
                Schema::table($table, function (Blueprint $table) {
                    $table->dropIndex(['user_id']);
                    $table->dropColumn('user_id');
                });
            }
        }
    }

    private function addUserId(string $tableName, int $defaultUserId): void
    {
        if (! Schema::hasTable($tableName) || Schema::hasColumn($tableName, 'user_id')) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->after('id');
            $table->index('user_id');
        });

        DB::table($tableName)->whereNull('user_id')->update(['user_id' => $defaultUserId]);
    }

    private function createApiTokens(): void
    {
        if (Schema::hasTable('api_tokens')) {
            return;
        }

        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('name')->nullable();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    private function defaultUserId(): int
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
};
