<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('personal_expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('definition');
            $table->decimal('amount', 12, 2);
            $table->date('expense_date');
            $table->string('frequency', 20)->default('monthly');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'frequency']);
            $table->index(['user_id', 'expense_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_expenses');
    }
};
