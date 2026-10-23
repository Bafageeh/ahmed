<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ta3meed_investor_audits', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('actor_user_id');
            $table->unsignedBigInteger('investor_id')->nullable();
            $table->unsignedBigInteger('opportunity_id')->nullable()->index();
            $table->unsignedBigInteger('allocation_id')->nullable();
            $table->string('action', 60);
            $table->text('reason')->nullable();
            $table->longText('before_json');
            $table->longText('after_json');
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ta3meed_investor_audits');
    }
};
