<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('investment_opportunities')) {
            return;
        }

        Schema::table('investment_opportunities', function (Blueprint $table) {
            if (! Schema::hasColumn('investment_opportunities', 'received_at')) {
                $table->date('received_at')->nullable()->after('maturity_date')->index();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('investment_opportunities')) {
            return;
        }

        Schema::table('investment_opportunities', function (Blueprint $table) {
            if (Schema::hasColumn('investment_opportunities', 'received_at')) {
                $table->dropColumn('received_at');
            }
        });
    }
};
