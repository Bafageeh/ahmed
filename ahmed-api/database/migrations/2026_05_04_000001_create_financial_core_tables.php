<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('investment_platforms', function (Blueprint $table) {
            $table->id();
            $table->string('code', 60)->unique();
            $table->string('name_ar');
            $table->string('name_en')->nullable();
            $table->string('category', 80)->default('investment');
            $table->string('calculation_method', 80)->default('custom');
            $table->text('description')->nullable();
            $table->json('settings')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('income_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('source_type', 60)->default('manual')->index();
            $table->string('linked_app_key', 80)->nullable()->index();
            $table->string('default_currency', 3)->default('SAR');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('investment_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('platform_id')->constrained('investment_platforms')->cascadeOnDelete();
            $table->string('display_name');
            $table->string('account_reference')->nullable()->index();
            $table->string('currency', 3)->default('SAR');
            $table->decimal('wallet_balance', 18, 2)->default(0);
            $table->decimal('total_invested_snapshot', 18, 2)->default(0);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->index(['user_id', 'platform_id']);
        });

        Schema::create('investment_opportunities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('investment_accounts')->cascadeOnDelete();
            $table->foreignId('platform_id')->constrained('investment_platforms')->cascadeOnDelete();
            $table->string('title');
            $table->string('reference_number')->nullable()->index();
            $table->string('investment_type', 80)->default('other')->index();
            $table->decimal('principal_amount', 18, 2)->default(0);
            $table->decimal('expected_profit_amount', 18, 2)->default(0);
            $table->decimal('actual_profit_amount', 18, 2)->default(0);
            $table->decimal('expected_rate', 10, 4)->nullable();
            $table->date('start_date')->nullable()->index();
            $table->date('maturity_date')->nullable()->index();
            $table->date('completed_at')->nullable();
            $table->string('status', 40)->default('active')->index();
            $table->string('profit_distribution', 60)->default('unknown')->index();
            $table->json('metadata')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['platform_id', 'status']);
            $table->index(['account_id', 'status']);
        });

        Schema::create('external_app_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('app_key', 80)->index();
            $table->string('name');
            $table->string('source_table')->nullable();
            $table->json('sync_settings')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->unique(['user_id', 'app_key']);
        });

        Schema::create('financial_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('platform_id')->nullable()->constrained('investment_platforms')->nullOnDelete();
            $table->foreignId('opportunity_id')->nullable()->constrained('investment_opportunities')->nullOnDelete();
            $table->foreignId('income_source_id')->nullable()->constrained('income_sources')->nullOnDelete();
            $table->string('external_app_key', 80)->nullable()->index();
            $table->string('reference_number')->nullable()->index();
            $table->string('transaction_type', 80)->index();
            $table->string('direction', 20)->default('neutral')->index();
            $table->decimal('amount', 18, 2);
            $table->string('currency', 3)->default('SAR');
            $table->date('transaction_date')->index();
            $table->date('due_date')->nullable()->index();
            $table->string('status', 40)->default('settled')->index();
            $table->string('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'transaction_date']);
            $table->index(['platform_id', 'transaction_type']);
            $table->index(['status', 'due_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_transactions');
        Schema::dropIfExists('external_app_links');
        Schema::dropIfExists('investment_opportunities');
        Schema::dropIfExists('investment_accounts');
        Schema::dropIfExists('income_sources');
        Schema::dropIfExists('investment_platforms');
    }
};
