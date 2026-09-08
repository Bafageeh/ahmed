<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('bank_statement_schedules')) {
            Schema::create('bank_statement_schedules', function (Blueprint $table) {
                $table->id();
                $table->string('bank_key', 40)->unique();
                $table->string('bank_name', 160);
                $table->unsignedTinyInteger('statement_day')->nullable();
                $table->timestamps();
            });
        }

        $now = now();
        $banks = [
            ['bank_key' => 'snb', 'bank_name' => 'البنك الأهلي السعودي'],
            ['bank_key' => 'alrajhi', 'bank_name' => 'مصرف الراجحي'],
            ['bank_key' => 'riyad', 'bank_name' => 'بنك الرياض'],
            ['bank_key' => 'sab', 'bank_name' => 'البنك السعودي الأول'],
            ['bank_key' => 'anb', 'bank_name' => 'البنك العربي الوطني'],
            ['bank_key' => 'alinma', 'bank_name' => 'مصرف الإنماء'],
            ['bank_key' => 'bsf', 'bank_name' => 'البنك السعودي الفرنسي'],
            ['bank_key' => 'saib', 'bank_name' => 'البنك السعودي للاستثمار'],
            ['bank_key' => 'aljazira', 'bank_name' => 'بنك الجزيرة'],
            ['bank_key' => 'albilad', 'bank_name' => 'بنك البلاد'],
            ['bank_key' => 'gib', 'bank_name' => 'بنك الخليج الدولي - السعودية'],
            ['bank_key' => 'stc', 'bank_name' => 'STC Bank'],
            ['bank_key' => 'vision', 'bank_name' => 'Vision Bank'],
            ['bank_key' => 'd360', 'bank_name' => 'D360 Bank'],
        ];

        foreach ($banks as $bank) {
            DB::table('bank_statement_schedules')->updateOrInsert(
                ['bank_key' => $bank['bank_key']],
                ['bank_name' => $bank['bank_name'], 'updated_at' => $now, 'created_at' => $now]
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_statement_schedules');
    }
};
