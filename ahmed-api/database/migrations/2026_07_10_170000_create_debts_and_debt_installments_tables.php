<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('debts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('name');
            $table->string('category')->nullable();
            $table->decimal('original_amount', 16, 2);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('debt_installments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('debt_id')->constrained('debts')->cascadeOnDelete();
            $table->date('due_date');
            $table->decimal('scheduled_amount', 16, 2);
            $table->decimal('paid_amount', 16, 2)->default(0);
            $table->date('paid_at')->nullable();
            $table->string('status')->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['debt_id', 'due_date']);
            $table->index(['due_date', 'status']);
        });

        $this->seedAdminDebts();
    }

    public function down(): void
    {
        Schema::dropIfExists('debt_installments');
        Schema::dropIfExists('debts');
    }

    private function seedAdminDebts(): void
    {
        $userId = 1;
        $now = now();

        $createDebt = function (string $name, string $category, float $originalAmount, string $notes) use ($userId, $now): int {
            return DB::table('debts')->insertGetId([
                'user_id' => $userId,
                'name' => $name,
                'category' => $category,
                'original_amount' => $originalAmount,
                'notes' => $notes,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        };

        $insertMonthlyRange = function (int $debtId, string $from, string $to, float $amount) use ($now): void {
            $cursor = Carbon::parse($from)->startOfMonth();
            $end = Carbon::parse($to)->startOfMonth();
            $rows = [];

            while ($cursor->lte($end)) {
                $rows[] = [
                    'debt_id' => $debtId,
                    'due_date' => $cursor->copy()->endOfMonth()->toDateString(),
                    'scheduled_amount' => $amount,
                    'paid_amount' => 0,
                    'paid_at' => null,
                    'status' => 'pending',
                    'notes' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $cursor->addMonth();
            }

            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('debt_installments')->insert($chunk);
            }
        };

        $insertSingle = function (int $debtId, string $month, float $amount, ?string $notes = null) use ($now): void {
            $dueDate = Carbon::parse($month)->endOfMonth()->toDateString();
            DB::table('debt_installments')->insert([
                'debt_id' => $debtId,
                'due_date' => $dueDate,
                'scheduled_amount' => $amount,
                'paid_amount' => 0,
                'paid_at' => null,
                'status' => 'pending',
                'notes' => $notes,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        };

        $mercedesId = $createDebt(
            'سيارة مرسيدس',
            'سيارة',
            418887.89,
            'مستورد من شيت خط زمني للأقساط. القسط الشهري 5,627.67 ر.س ثم دفعة أخيرة كبيرة.'
        );
        $insertMonthlyRange($mercedesId, '2026-07-01', '2030-05-01', 5627.67);
        $insertSingle($mercedesId, '2030-06-01', 154387.40, 'الدفعة الأخيرة');

        $villaId = $createDebt(
            'فيلا أبحر',
            'عقار',
            615227.69,
            'مستورد من شيت خط زمني للأقساط. قسط شهري ثابت 7,989.97 ر.س.'
        );
        $insertMonthlyRange($villaId, '2026-07-01', '2032-11-01', 7989.97);

        $wurudId = $createDebt(
            'شقة الورود 1',
            'عقار',
            678690.00,
            'مستورد من شيت خط زمني للأقساط مع تغير مؤقت في قيمة القسط خلال 2027.'
        );
        $insertMonthlyRange($wurudId, '2026-07-01', '2027-06-01', 3713.00);
        $insertMonthlyRange($wurudId, '2027-07-01', '2027-11-01', 2042.00);
        $insertMonthlyRange($wurudId, '2027-12-01', '2041-10-01', 3713.00);
        $insertSingle($wurudId, '2041-11-01', 3853.00, 'الدفعة الأخيرة');
    }
};
