<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('debts', function (Blueprint $table) {
            if (! Schema::hasColumn('debts', 'contract_date')) {
                $table->date('contract_date')->nullable()->after('category');
            }
            if (! Schema::hasColumn('debts', 'down_payment')) {
                $table->decimal('down_payment', 16, 2)->default(0)->after('contract_date');
            }
            if (! Schema::hasColumn('debts', 'financing_amount')) {
                $table->decimal('financing_amount', 16, 2)->nullable()->after('down_payment');
            }
            if (! Schema::hasColumn('debts', 'profit_amount')) {
                $table->decimal('profit_amount', 16, 2)->default(0)->after('financing_amount');
            }
            if (! Schema::hasColumn('debts', 'profit_margin')) {
                $table->decimal('profit_margin', 8, 4)->nullable()->after('profit_amount');
            }
            if (! Schema::hasColumn('debts', 'previous_installment_amount')) {
                $table->decimal('previous_installment_amount', 16, 2)->nullable()->after('profit_margin');
            }
            if (! Schema::hasColumn('debts', 'previous_installments_count')) {
                $table->unsignedInteger('previous_installments_count')->nullable()->after('previous_installment_amount');
            }
        });

        DB::table('debts')
            ->where('user_id', 1)
            ->whereIn('name', ['شقة الورود 1', 'شقة الورود'])
            ->update([
                'name' => 'شقة الورود',
                'contract_date' => '2021-11-16',
                'down_payment' => 500000.00,
                'financing_amount' => 500000.00,
                'profit_amount' => 291000.00,
                'profit_margin' => 2.9100,
                'previous_installment_amount' => 2042.00,
                'previous_installments_count' => 55,
                'original_amount' => 791000.00,
                'opening_paid_amount' => 112310.00,
                'notes' => 'تاريخ العقد 16-11-2021، الدفعة الأولى 500,000 ر.س، مبلغ التمويل 500,000 ر.س، مبلغ الربح 291,000 ر.س، هامش الربح 2.91%. تم سداد 55 قسطًا سابقًا بقيمة 2,042 ر.س بإجمالي 112,310 ر.س، والمتبقي 678,690 ر.س. إجمالي تكلفة العقار مع الربح والدفعة الأولى 1,291,000 ر.س.',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        Schema::table('debts', function (Blueprint $table) {
            foreach ([
                'contract_date',
                'down_payment',
                'financing_amount',
                'profit_amount',
                'profit_margin',
                'previous_installment_amount',
                'previous_installments_count',
            ] as $column) {
                if (Schema::hasColumn('debts', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
