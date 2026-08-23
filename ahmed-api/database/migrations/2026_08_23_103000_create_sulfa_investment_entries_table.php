<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sulfa_investment_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('label')->nullable();
            $table->decimal('invested_amount', 15, 2)->default(0);
            $table->decimal('expected_profit', 15, 2)->default(0);
            $table->unsignedSmallInteger('duration_months')->default(24);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
        });

        // Preserve the previously registered Sulfa amount as one 24-month entry.
        // Its expected profit is derived from the old annual rate so the monthly
        // profit remains unchanged until the user replaces it with real entries.
        if (Schema::hasTable('sulfa_investments')) {
            DB::table('sulfa_investments')
                ->orderBy('id')
                ->get()
                ->each(function ($item) {
                    $amount = (float) ($item->invested_amount ?? 0);
                    if ($amount <= 0) {
                        return;
                    }

                    $annualRate = (float) ($item->annual_rate ?? 10.5);
                    $durationMonths = 24;
                    $expectedProfit = $amount * ($annualRate / 100) * ($durationMonths / 12);

                    DB::table('sulfa_investment_entries')->insert([
                        'user_id' => $item->user_id,
                        'label' => 'الاستثمار السابق',
                        'invested_amount' => round($amount, 2),
                        'expected_profit' => round($expectedProfit, 2),
                        'duration_months' => $durationMonths,
                        'is_active' => true,
                        'notes' => 'تم ترحيله تلقائيًا من المبلغ السابق في سلفة.',
                        'created_at' => $item->created_at ?? now(),
                        'updated_at' => now(),
                    ]);
                });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sulfa_investment_entries');
    }
};
