<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ta3meed_receipts')) {
            Schema::create('ta3meed_receipts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('opportunity_id');
                $table->decimal('amount', 14, 2);
                $table->string('receipt_type', 30)->default('partial');
                $table->date('receipt_date')->nullable();
                $table->string('reference_number', 100)->nullable();
                $table->text('source_message')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('opportunity_id');
                $table->index('reference_number');
            });
        }

        if (! Schema::hasTable('ta3meed_receipt_allocations')) {
            Schema::create('ta3meed_receipt_allocations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('receipt_id');
                $table->unsignedBigInteger('opportunity_id');
                $table->unsignedBigInteger('allocation_id')->nullable();
                $table->unsignedBigInteger('investor_id')->nullable();
                $table->decimal('share_percent', 10, 6)->default(0);
                $table->decimal('received_amount', 14, 2)->default(0);
                $table->timestamps();

                $table->index('receipt_id');
                $table->index('opportunity_id');
                $table->index('investor_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ta3meed_receipt_allocations');
        Schema::dropIfExists('ta3meed_receipts');
    }
};
