<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DinarInvestmentController extends Controller
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();
        $this->seedDefaults($userId);

        $items = DB::table('dinar_investments')
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->get()
            ->map(function ($item) use ($userId) {
                $item->payments = DB::table('dinar_payments')
                    ->where('user_id', $userId)
                    ->where('dinar_investment_id', $item->id)
                    ->orderBy('installment_no')
                    ->get();

                return $item;
            })
            ->values();

        $unlinked = DB::table('dinar_payments')
            ->where('user_id', $userId)
            ->whereNull('dinar_investment_id')
            ->orderByDesc('due_date')
            ->get();

        return response()->json([
            'data' => $items,
            'unlinked_payments' => $unlinked,
            'summary' => $this->summary($items, $unlinked),
        ]);
    }

    public function togglePayment(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();

        $payment = DB::table('dinar_payments')
            ->where('user_id', $userId)
            ->where('id', $id)
            ->first();

        if (! $payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        $isPaid = $request->has('is_paid')
            ? filter_var($request->input('is_paid'), FILTER_VALIDATE_BOOLEAN)
            : ! (bool) $payment->is_paid;

        $amount = $isPaid
            ? (float) ($request->input('paid_amount') ?: $payment->total_distribution)
            : null;

        DB::table('dinar_payments')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->update([
                'is_paid' => $isPaid,
                'paid_at' => $isPaid ? ($request->input('paid_at') ?: now()->toDateString()) : null,
                'paid_amount' => $amount,
                'updated_at' => now(),
            ]);

        return response()->json([
            'data' => DB::table('dinar_payments')->where('id', $id)->first(),
        ]);
    }

    private function ensureSchema(): void
    {
        if (! Schema::hasTable('dinar_investments')) {
            Schema::create('dinar_investments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->string('external_key')->nullable()->index();
                $table->string('title');
                $table->string('company_name')->nullable();
                $table->decimal('annual_return', 8, 2)->default(0);
                $table->unsignedInteger('duration_months')->default(0);
                $table->unsignedInteger('units')->default(0);
                $table->decimal('investment_amount', 15, 2)->default(0);
                $table->string('profit_method')->nullable();
                $table->string('capital_method')->nullable();
                $table->string('status')->default('active');
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('dinar_payments')) {
            Schema::create('dinar_payments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->unsignedBigInteger('dinar_investment_id')->nullable()->index();
                $table->unsignedInteger('installment_no')->nullable();
                $table->date('due_date')->nullable()->index();
                $table->decimal('distribution_per_unit', 15, 2)->default(0);
                $table->decimal('principal_per_unit', 15, 2)->default(0);
                $table->decimal('total_distribution', 15, 2)->default(0);
                $table->decimal('total_principal', 15, 2)->default(0);
                $table->boolean('is_paid')->default(false)->index();
                $table->date('paid_at')->nullable();
                $table->decimal('paid_amount', 15, 2)->nullable();
                $table->string('title')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }
    }

    private function seedDefaults(int $userId): void
    {
        if (DB::table('dinar_investments')->where('user_id', $userId)->exists()) {
            return;
        }

        $investments = [
            [
                'key' => 'mohammed-al-taleb',
                'title' => 'صكوك شركة محمد عبدالله آل طالب وشركاه للتجارة والزراعة',
                'company' => 'شركة محمد عبدالله آل طالب وشركاه للتجارة والزراعة',
                'rate' => 15.50,
                'months' => 6,
                'units' => 25,
                'amount' => 25000,
                'profit_method' => 'على دفعتين',
                'capital_method' => 'رأس المال مع آخر دفعة',
                'payments' => [
                    [1, '2026-06-12', 38.75, 0],
                    [2, '2026-09-12', 38.75, 1000],
                ],
            ],
            [
                'key' => 'alkarama',
                'title' => 'صكوك شركة الكرامة المحدودة لإنتاج المعجنات',
                'company' => 'شركة الكرامة المحدودة لإنتاج المعجنات',
                'rate' => 16.50,
                'months' => 12,
                'units' => 25,
                'amount' => 25000,
                'profit_method' => 'ربع سنوي',
                'capital_method' => 'رأس المال مع آخر دفعة',
                'payments' => [
                    [1, '2026-06-11', 41.25, 0],
                    [2, '2026-09-11', 41.25, 0],
                    [3, '2026-12-10', 41.25, 0],
                    [4, '2027-03-10', 41.25, 1000],
                ],
            ],
            [
                'key' => 'almahatta',
                'title' => 'صكوك شركة المحطة للمقاولات المحدودة',
                'company' => 'شركة المحطة للمقاولات المحدودة',
                'rate' => 16.76,
                'months' => 12,
                'units' => 1,
                'amount' => 1000,
                'profit_method' => 'ربع سنوي',
                'capital_method' => 'رأس المال مع آخر دفعة',
                'payments' => [
                    [1, '2026-06-05', 41.90, 0],
                    [2, '2026-09-05', 41.90, 0],
                    [3, '2026-12-04', 41.90, 0],
                    [4, '2027-03-04', 41.90, 1000],
                ],
            ],
            [
                'key' => 'kifah-12m',
                'title' => 'صكوك شركة الكفاح القابضة',
                'company' => 'شركة الكفاح القابضة',
                'rate' => 16.00,
                'months' => 12,
                'units' => 10,
                'amount' => 10000,
                'profit_method' => 'ربع سنوي',
                'capital_method' => 'رأس المال مع آخر دفعة',
                'payments' => [
                    [1, '2026-06-03', 40.00, 0],
                    [2, '2026-09-03', 40.00, 0],
                    [3, '2026-12-02', 40.00, 0],
                    [4, '2027-03-02', 40.00, 1000],
                ],
            ],
            [
                'key' => 'kifah-6m',
                'title' => 'صكوك شركة الكفاح القابضة',
                'company' => 'شركة الكفاح القابضة',
                'rate' => 15.54,
                'months' => 6,
                'units' => 5,
                'amount' => 5000,
                'profit_method' => 'على دفعتين',
                'capital_method' => 'رأس المال مع آخر دفعة',
                'payments' => [
                    [1, '2026-06-02', 38.85, 0],
                    [2, '2026-09-02', 38.85, 1000],
                ],
            ],
            [
                'key' => 'asloob',
                'title' => 'صكوك شركة أسلوب بدائع للمقاولات',
                'company' => 'شركة أسلوب بدائع للمقاولات',
                'rate' => 15.60,
                'months' => 6,
                'units' => 5,
                'amount' => 5000,
                'profit_method' => 'على دفعتين',
                'capital_method' => 'رأس المال مع آخر دفعة',
                'payments' => [
                    [1, '2026-06-03', 39.00, 0],
                    [2, '2026-09-03', 39.00, 1000],
                ],
            ],
            [
                'key' => 'gulf-gate',
                'title' => 'صكوك شركة بوابة الخليج للصناعة',
                'company' => 'شركة بوابة الخليج للصناعة',
                'rate' => 15.68,
                'months' => 9,
                'units' => 6,
                'amount' => 6000,
                'profit_method' => 'كل 3 أشهر',
                'capital_method' => 'رأس المال مع آخر دفعة',
                'payments' => [
                    [1, '2026-06-02', 39.20, 0],
                    [2, '2026-09-02', 39.20, 0],
                    [3, '2026-12-01', 39.20, 1000],
                ],
            ],
            [
                'key' => 'alameen',
                'title' => 'صكوك شركة الأمين للتنمية والتجارة المحدودة',
                'company' => 'شركة الأمين للتنمية والتجارة المحدودة',
                'rate' => 16.08,
                'months' => 15,
                'units' => 10,
                'amount' => 10000,
                'profit_method' => 'كل 3 أشهر',
                'capital_method' => 'رأس المال مع آخر دفعة',
                'payments' => [
                    [1, '2026-05-19', 40.20, 0],
                    [2, '2026-08-19', 40.20, 0],
                    [3, '2026-11-18', 40.20, 0],
                    [4, '2027-02-18', 40.20, 0],
                    [5, '2027-05-19', 40.20, 1000],
                ],
            ],
            [
                'key' => '0116-162',
                'title' => 'صكوك المرابحة 0116-162',
                'company' => 'شركة التخصصات العالمية للتجارة',
                'rate' => 15.34,
                'months' => 12,
                'units' => 5,
                'amount' => 5000,
                'profit_method' => 'حسب جدول 3 دفعات',
                'capital_method' => 'رأس المال مع آخر دفعة',
                'payments' => [
                    [1, '2026-01-26', 76.70, 0],
                    [2, '2026-04-27', 38.35, 0],
                    [3, '2026-07-27', 38.35, 1000],
                ],
            ],
            [
                'key' => '0201-128',
                'title' => 'صكوك المرابحة 0201-128',
                'company' => 'شركة إنجاز الطرق للمقاولات المحدودة',
                'rate' => 15.84,
                'months' => 10,
                'units' => 5,
                'amount' => 5000,
                'profit_method' => 'دفعة واحدة',
                'capital_method' => 'رأس المال مع نفس الدفعة',
                'payments' => [
                    [1, '2026-05-15', 132.00, 1000],
                ],
            ],
        ];

        $paid = [
            'mohammed-al-taleb|2026-06-12' => 968.75,
            'alkarama|2026-06-11' => 1031.25,
            'almahatta|2026-06-05' => 41.90,
            'asloob|2026-06-03' => 195.00,
            'kifah-12m|2026-06-03' => 400.00,
            'kifah-6m|2026-06-02' => 194.25,
            'gulf-gate|2026-06-02' => 235.20,
            'alameen|2026-05-19' => 402.00,
            '0116-162|2026-01-26' => 383.50,
            '0116-162|2026-04-27' => 191.75,
        ];

        DB::transaction(function () use ($investments, $paid, $userId) {
            foreach ($investments as $item) {
                $investmentId = DB::table('dinar_investments')->insertGetId([
                    'user_id' => $userId,
                    'external_key' => $item['key'],
                    'title' => $item['title'],
                    'company_name' => $item['company'],
                    'annual_return' => $item['rate'],
                    'duration_months' => $item['months'],
                    'units' => $item['units'],
                    'investment_amount' => $item['amount'],
                    'profit_method' => $item['profit_method'],
                    'capital_method' => $item['capital_method'],
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach ($item['payments'] as $row) {
                    [$no, $date, $distribution, $principal] = $row;
                    $paidKey = $item['key'] . '|' . $date;
                    $isPaid = array_key_exists($paidKey, $paid);

                    DB::table('dinar_payments')->insert([
                        'user_id' => $userId,
                        'dinar_investment_id' => $investmentId,
                        'installment_no' => $no,
                        'due_date' => $date,
                        'distribution_per_unit' => $distribution,
                        'principal_per_unit' => $principal,
                        'total_distribution' => round($distribution * $item['units'], 2),
                        'total_principal' => round($principal * $item['units'], 2),
                        'is_paid' => $isPaid,
                        'paid_at' => $isPaid ? $date : null,
                        'paid_amount' => $isPaid ? $paid[$paidKey] : null,
                        'title' => $item['title'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            DB::table('dinar_payments')->insert([
                [
                    'user_id' => $userId,
                    'dinar_investment_id' => null,
                    'due_date' => '2026-06-03',
                    'total_distribution' => 1038.20,
                    'is_paid' => true,
                    'paid_at' => '2026-06-03',
                    'paid_amount' => 1038.20,
                    'title' => 'صكوك شركة الكفاح القابضة',
                    'notes' => 'مدفوع ظاهر في الصورة وغير مربوط بفرصة مدخلة',
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'user_id' => $userId,
                    'dinar_investment_id' => null,
                    'due_date' => '2026-06-03',
                    'total_distribution' => 2067.00,
                    'is_paid' => true,
                    'paid_at' => '2026-06-03',
                    'paid_amount' => 2067.00,
                    'title' => 'صكوك شركة محمد وباسم أبناء ياسين الغدير وشركاه',
                    'notes' => 'مدفوع ظاهر في الصورة وغير مربوط بفرصة مدخلة',
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        });
    }

    private function summary($items, $unlinked): array
    {
        $totalInvestment = 0;
        $expectedDistributions = 0;
        $linkedPaid = 0;

        foreach ($items as $item) {
            $totalInvestment += (float) $item->investment_amount;

            foreach ($item->payments as $payment) {
                $expectedDistributions += (float) $payment->total_distribution;
                if ($payment->is_paid) {
                    $linkedPaid += (float) ($payment->paid_amount ?: $payment->total_distribution);
                }
            }
        }

        $unlinkedPaid = collect($unlinked)->sum(fn ($payment) => (float) ($payment->paid_amount ?: $payment->total_distribution));

        return [
            'total_investment' => round($totalInvestment, 2),
            'expected_distributions' => round($expectedDistributions, 2),
            'linked_paid_distributions' => round($linkedPaid, 2),
            'unlinked_paid_distributions' => round($unlinkedPaid, 2),
            'paid_distributions' => round($linkedPaid + $unlinkedPaid, 2),
            'remaining_distributions' => round(max(0, $expectedDistributions - $linkedPaid), 2),
            'opportunities_count' => count($items),
        ];
    }

    private function userId(Request $request): int
    {
        $id = (int) $request->header('X-Ahmed-User-Id', 0);
        if ($id > 0 && Schema::hasTable('users') && DB::table('users')->where('id', $id)->exists()) {
            return $id;
        }

        return Schema::hasTable('users')
            ? (int) (DB::table('users')->orderBy('id')->value('id') ?: 1)
            : 1;
    }
}
