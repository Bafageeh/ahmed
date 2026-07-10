<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('debts', 'opening_paid_amount')) {
            Schema::table('debts', function (Blueprint $table) {
                $table->decimal('opening_paid_amount', 16, 2)->default(0)->after('original_amount');
            });
        }

        DB::table('debts')
            ->where('user_id', 1)
            ->whereIn('name', ['فيلا أبحر', 'فيلا'])
            ->update([
                'name' => 'فيلا أبحر',
                'original_amount' => 1917592.80,
                'opening_paid_amount' => 1302365.11,
                'auto_payment_day' => 26,
                'notes' => 'العقد التمويلي 15-10-2012، أول سحب 26-11-2012، دفعة أولى 200,000 ر.س، مبلغ التمويل 1,200,000 ر.س، الربح 717,592.80 ر.س، إجمالي التمويل 1,917,592.80 ر.س، المسدد حتى يونيو 2026 مبلغ 1,302,365.11 ر.س، والمتبقي 615,227.69 ر.س. آخر قسط 26-11-2032، والسداد آلي يوم 26 من كل شهر.',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('debts', 'opening_paid_amount')) {
            Schema::table('debts', function (Blueprint $table) {
                $table->dropColumn('opening_paid_amount');
            });
        }
    }
};
