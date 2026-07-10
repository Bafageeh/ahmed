<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_card_debts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('bank_name', 120);
            $table->string('card_name', 120);
            $table->decimal('credit_limit', 16, 2);
            $table->timestamps();

            $table->index(['user_id', 'bank_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_card_debts');
    }
};
