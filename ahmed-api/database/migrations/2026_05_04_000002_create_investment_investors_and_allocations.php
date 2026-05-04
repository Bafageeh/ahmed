<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('investment_investors', function (Blueprint $table) {
            $table->id();
            $table->string('code', 60)->unique();
            $table->string('name');
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('investment_opportunity_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opportunity_id')->constrained('investment_opportunities')->cascadeOnDelete();
            $table->foreignId('investor_id')->constrained('investment_investors')->cascadeOnDelete();
            $table->decimal('invested_amount', 18, 2)->default(0);
            $table->decimal('expected_profit_amount', 18, 2)->default(0);
            $table->decimal('actual_profit_amount', 18, 2)->default(0);
            $table->decimal('received_amount', 18, 2)->default(0);
            $table->string('status', 40)->default('active')->index();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['opportunity_id', 'investor_id'], 'opportunity_investor_unique');
            $table->index(['investor_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('investment_opportunity_allocations');
        Schema::dropIfExists('investment_investors');
    }
};
