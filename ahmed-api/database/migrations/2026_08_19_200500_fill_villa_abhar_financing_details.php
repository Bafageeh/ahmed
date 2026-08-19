<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('debts')
            ->where('user_id', 1)
            ->where(function ($query) {
                $query->whereIn('name', ['فيلا', 'فيلا أبحر', 'فيلا ابحر'])
                    ->orWhere('original_amount', 1917592.80);
            })
            ->update([
                'contract_date' => '2012-10-15',
                'down_payment' => 200000.00,
                'financing_amount' => 1200000.00,
                'profit_amount' => 717592.80,
                'profit_margin' => 2.9899,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('debts')
            ->where('user_id', 1)
            ->where(function ($query) {
                $query->whereIn('name', ['فيلا', 'فيلا أبحر', 'فيلا ابحر'])
                    ->orWhere('original_amount', 1917592.80);
            })
            ->update([
                'contract_date' => null,
                'down_payment' => 0,
                'financing_amount' => null,
                'profit_amount' => 0,
                'profit_margin' => null,
                'updated_at' => now(),
            ]);
    }
};
