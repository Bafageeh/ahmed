<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('secure_vault_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('owner_group', 80)->nullable()->index();
            $table->string('category', 40)->default('other')->index();
            $table->string('record_type', 40)->default('login')->index();
            $table->boolean('is_favorite')->default(false)->index();
            $table->string('title');
            $table->string('username')->nullable();
            $table->text('password_encrypted')->nullable();
            $table->string('url')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('purpose')->nullable();
            $table->string('tags')->nullable();
            $table->string('bank_name')->nullable();
            $table->text('bank_iban_encrypted')->nullable();
            $table->string('bank_account_short')->nullable();
            $table->string('cardholder_name')->nullable();
            $table->string('card_brand')->nullable();
            $table->text('card_number_encrypted')->nullable();
            $table->string('card_last_four', 4)->nullable();
            $table->text('card_cvv_encrypted')->nullable();
            $table->unsignedTinyInteger('expiry_month')->nullable();
            $table->unsignedSmallInteger('expiry_year')->nullable();
            $table->text('security_question_encrypted')->nullable();
            $table->text('security_answer_encrypted')->nullable();
            $table->text('backup_codes_encrypted')->nullable();
            $table->text('notes_encrypted')->nullable();
            $table->timestamp('last_viewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('secure_vault_items');
    }
};
