<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('sulfa_investment_entries')) {
            Schema::table('sulfa_investment_entries', function (Blueprint $table) {
                $table->string('opportunity_number', 40)->nullable()->after('label');
                $table->decimal('annual_rate', 6, 3)->default(10.500)->after('expected_profit');
                $table->date('investment_date')->nullable()->after('duration_months');
                $table->date('maturity_date')->nullable()->after('investment_date');
                $table->string('status', 20)->default('active')->after('is_active');
                $table->date('completed_at')->nullable()->after('status');

                $table->unique(
                    ['user_id', 'opportunity_number'],
                    'sulfa_entries_user_opportunity_unique'
                );
                $table->index(
                    ['user_id', 'status', 'investment_date'],
                    'sulfa_entries_user_status_date_index'
                );
            });
        }

        if (! Schema::hasTable('sulfa_investment_transactions')) {
            Schema::create('sulfa_investment_transactions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('transaction_type', 30)->index();
                $table->string('opportunity_number', 40)->nullable()->index();
                $table->decimal('amount', 15, 2);
                $table->date('transaction_date')->index();
                $table->time('transaction_time')->nullable();
                $table->string('status', 20)->default('completed')->index();
                $table->string('source', 80)->default('manual');
                $table->string('source_key', 160);
                $table->unsignedInteger('source_sequence')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->unique(
                    ['user_id', 'source_key'],
                    'sulfa_transactions_user_source_unique'
                );
                $table->index(
                    ['user_id', 'transaction_date', 'transaction_type'],
                    'sulfa_transactions_user_date_type_index'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sulfa_investment_transactions');

        if (Schema::hasTable('sulfa_investment_entries')) {
            Schema::table('sulfa_investment_entries', function (Blueprint $table) {
                $table->dropUnique('sulfa_entries_user_opportunity_unique');
                $table->dropIndex('sulfa_entries_user_status_date_index');
                $table->dropColumn([
                    'opportunity_number',
                    'annual_rate',
                    'investment_date',
                    'maturity_date',
                    'status',
                    'completed_at',
                ]);
            });
        }
    }
};
