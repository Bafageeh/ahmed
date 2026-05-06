<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ta3meed_investor_account_entries')) {
            return;
        }

        Schema::create('ta3meed_investor_account_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('investor_id')->constrained('investment_investors')->cascadeOnDelete();
            $table->decimal('amount', 14, 2)->default(0);
            $table->date('entry_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['investor_id', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ta3meed_investor_account_entries');
    }
};
