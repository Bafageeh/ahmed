<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TokenizeInvestmentController extends Controller
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();
        $this->seedDefaults($userId);

        $items = DB::table('tokenize_investments')
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->get()
            ->map(fn ($item) => $this->withPayments($item, $userId))
            ->values();

        return response()->json([
            'data' => $items,
            'summary' => $this->summary($items),
        ]);
    }

    public function store(Request $request)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();
        $data = $this->validateInvestment($request);

        $id = DB::table('tokenize_investments')->insertGetId([
            'user_id' => $userId,
            ...$this->investmentPayload($data),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => $this->withPayments(DB::table('tokenize_investments')->where('id', $id)->first(), $userId),
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();
        $item = DB::table('tokenize_investments')->where('user_id', $userId)->where('id', $id)->first();
        if (! $item) return response()->json(['message' => 'الفرصة غير موجودة'], 404);

        $data = $this->validateInvestment($request);
        DB::table('tokenize_investments')->where('user_id', $userId)->where('id', $id)->update([
            ...$this->investmentPayload($data),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => $this->withPayments(DB::table('tokenize_investments')->where('id', $id)->first(), $userId),
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();
        $exists = DB::table('tokenize_investments')->where('user_id', $userId)->where('id', $id)->exists();
        if (! $exists) return response()->json(['message' => 'الفرصة غير موجودة'], 404);

        DB::transaction(function () use ($userId, $id) {
            DB::table('tokenize_payments')->where('user_id', $userId)->where('tokenize_investment_id', $id)->delete();
            DB::table('tokenize_investments')->where('user_id', $userId)->where('id', $id)->delete();
        });

        return response()->json(['message' => 'تم حذف الفرصة']);
    }

    public function storePayment(Request $request, int $investmentId)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();
        $investment = DB::table('tokenize_investments')->where('user_id', $userId)->where('id', $investmentId)->first();
        if (! $investment) return response()->json(['message' => 'الفرصة غير موجودة'], 404);

        $data = $this->validatePayment($request);
        $nextNo = (int) DB::table('tokenize_payments')
            ->where('user_id', $userId)
            ->where('tokenize_investment_id', $investmentId)
            ->max('installment_no') + 1;

        $id = DB::table('tokenize_payments')->insertGetId([
            'user_id' => $userId,
            'tokenize_investment_id' => $investmentId,
            'installment_no' => $data['installment_no'] ?? $nextNo,
            'due_date' => $data['due_date'],
            'profit_amount' => $data['profit_amount'] ?? 0,
            'principal_amount' => $data['principal_amount'] ?? 0,
            'is_paid' => (bool) ($data['is_paid'] ?? false),
            'paid_at' => ! empty($data['is_paid']) ? ($data['paid_at'] ?? now()->toDateString()) : null,
            'notes' => $data['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('tokenize_payments')->where('id', $id)->first()], 201);
    }

    public function updatePayment(Request $request, int $investmentId, int $paymentId)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();
        $payment = DB::table('tokenize_payments')
            ->where('user_id', $userId)
            ->where('tokenize_investment_id', $investmentId)
            ->where('id', $paymentId)
            ->first();
        if (! $payment) return response()->json(['message' => 'الدفعة غير موجودة'], 404);

        $data = $this->validatePayment($request);
        $isPaid = (bool) ($data['is_paid'] ?? $payment->is_paid);
        DB::table('tokenize_payments')->where('id', $paymentId)->update([
            'installment_no' => $data['installment_no'] ?? $payment->installment_no,
            'due_date' => $data['due_date'],
            'profit_amount' => $data['profit_amount'] ?? 0,
            'principal_amount' => $data['principal_amount'] ?? 0,
            'is_paid' => $isPaid,
            'paid_at' => $isPaid ? ($data['paid_at'] ?? $payment->paid_at ?? now()->toDateString()) : null,
            'notes' => $data['notes'] ?? null,
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('tokenize_payments')->where('id', $paymentId)->first()]);
    }

    public function destroyPayment(Request $request, int $investmentId, int $paymentId)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();
        $deleted = DB::table('tokenize_payments')
            ->where('user_id', $userId)
            ->where('tokenize_investment_id', $investmentId)
            ->where('id', $paymentId)
            ->delete();
        if (! $deleted) return response()->json(['message' => 'الدفعة غير موجودة'], 404);
        return response()->json(['message' => 'تم حذف الدفعة']);
    }

    public function togglePayment(Request $request, int $paymentId)
    {
        $userId = $this->userId($request);
        $this->ensureSchema();
        $payment = DB::table('tokenize_payments')->where('user_id', $userId)->where('id', $paymentId)->first();
        if (! $payment) return response()->json(['message' => 'الدفعة غير موجودة'], 404);

        $isPaid = $request->has('is_paid')
            ? filter_var($request->input('is_paid'), FILTER_VALIDATE_BOOLEAN)
            : ! (bool) $payment->is_paid;

        DB::table('tokenize_payments')->where('id', $paymentId)->update([
            'is_paid' => $isPaid,
            'paid_at' => $isPaid ? ($request->input('paid_at') ?: now()->toDateString()) : null,
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('tokenize_payments')->where('id', $paymentId)->first()]);
    }

    private function validateInvestment(Request $request): array
    {
        return $request->validate([
            'external_key' => ['required', 'string', 'max:80'],
            'title' => ['required', 'string', 'max:180'],
            'sector' => ['nullable', 'string', 'max:120'],
            'investment_amount' => ['required', 'numeric', 'min:0'],
            'units' => ['nullable', 'integer', 'min:0'],
            'duration_months' => ['required', 'integer', 'min:1', 'max:240'],
            'roi' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'apr' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'irr' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'distribution_type' => ['nullable', 'string', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'status' => ['nullable', 'in:active,completed,paused'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function validatePayment(Request $request): array
    {
        return $request->validate([
            'installment_no' => ['nullable', 'integer', 'min:1'],
            'due_date' => ['required', 'date'],
            'profit_amount' => ['nullable', 'numeric', 'min:0'],
            'principal_amount' => ['nullable', 'numeric', 'min:0'],
            'is_paid' => ['nullable', 'boolean'],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    private function investmentPayload(array $data): array
    {
        return [
            'external_key' => trim($data['external_key']),
            'title' => trim($data['title']),
            'sector' => $data['sector'] ?? null,
            'investment_amount' => $data['investment_amount'],
            'units' => $data['units'] ?? 0,
            'duration_months' => $data['duration_months'],
            'roi' => $data['roi'] ?? 0,
            'apr' => $data['apr'] ?? 0,
            'irr' => $data['irr'] ?? 0,
            'distribution_type' => $data['distribution_type'] ?? null,
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'status' => $data['status'] ?? 'active',
            'notes' => $data['notes'] ?? null,
        ];
    }

    private function ensureSchema(): void
    {
        if (! Schema::hasTable('tokenize_investments')) {
            Schema::create('tokenize_investments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('external_key')->index();
                $table->string('title');
                $table->string('sector')->nullable();
                $table->decimal('investment_amount', 15, 2)->default(0);
                $table->unsignedInteger('units')->default(0);
                $table->unsignedInteger('duration_months')->default(0);
                $table->decimal('roi', 8, 2)->default(0);
                $table->decimal('apr', 8, 2)->default(0);
                $table->decimal('irr', 8, 2)->default(0);
                $table->string('distribution_type')->nullable();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->string('status')->default('active')->index();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->unique(['user_id', 'external_key']);
            });
        }

        if (! Schema::hasTable('tokenize_payments')) {
            Schema::create('tokenize_payments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->unsignedBigInteger('tokenize_investment_id')->index();
                $table->unsignedInteger('installment_no')->default(1);
                $table->date('due_date')->index();
                $table->decimal('profit_amount', 15, 2)->default(0);
                $table->decimal('principal_amount', 15, 2)->default(0);
                $table->boolean('is_paid')->default(false)->index();
                $table->date('paid_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }
    }

    private function seedDefaults(int $userId): void
    {
        if ($userId !== 1 || DB::table('tokenize_investments')->where('user_id', $userId)->exists()) return;

        $items = [
            [
                'external_key' => '1171-09',
                'title' => 'صكوك المرابحة 1171-09',
                'sector' => 'الصناعات',
                'investment_amount' => 10000,
                'units' => 10,
                'duration_months' => 12,
                'roi' => 13.75,
                'apr' => 13.75,
                'irr' => 14.48,
                'distribution_type' => 'ربع سنوي',
                'start_date' => '2026-11-24',
                'end_date' => '2027-08-24',
                'payments' => [
                    ['2026-11-24', 315.00, 0],
                    ['2027-02-24', 315.00, 0],
                    ['2027-05-24', 315.00, 0],
                    ['2027-08-24', 315.00, 10000.00],
                ],
            ],
            [
                'external_key' => '1159-24',
                'title' => 'صكوك المرابحة 1159-24',
                'sector' => 'البناء والتشييد',
                'investment_amount' => 10000,
                'units' => 10,
                'duration_months' => 14,
                'roi' => 17.50,
                'apr' => 15.00,
                'irr' => 14.83,
                'distribution_type' => 'ربع سنوي',
                'start_date' => '2026-11-03',
                'end_date' => '2027-10-03',
                'payments' => [
                    ['2026-11-03', 346.25, 0],
                    ['2027-02-03', 346.25, 0],
                    ['2027-05-03', 346.25, 0],
                    ['2027-08-03', 346.25, 0],
                    ['2027-10-03', 230.83, 10000.00],
                ],
            ],
        ];

        DB::transaction(function () use ($items, $userId) {
            foreach ($items as $item) {
                $investmentId = DB::table('tokenize_investments')->insertGetId([
                    'user_id' => $userId,
                    'external_key' => $item['external_key'],
                    'title' => $item['title'],
                    'sector' => $item['sector'],
                    'investment_amount' => $item['investment_amount'],
                    'units' => $item['units'],
                    'duration_months' => $item['duration_months'],
                    'roi' => $item['roi'],
                    'apr' => $item['apr'],
                    'irr' => $item['irr'],
                    'distribution_type' => $item['distribution_type'],
                    'start_date' => $item['start_date'],
                    'end_date' => $item['end_date'],
                    'status' => 'active',
                    'notes' => 'تم إدخال البيانات من صور منصة ترميز.',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach ($item['payments'] as $index => $payment) {
                    DB::table('tokenize_payments')->insert([
                        'user_id' => $userId,
                        'tokenize_investment_id' => $investmentId,
                        'installment_no' => $index + 1,
                        'due_date' => $payment[0],
                        'profit_amount' => $payment[1],
                        'principal_amount' => $payment[2],
                        'is_paid' => false,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        });
    }

    private function withPayments($item, int $userId)
    {
        $item->payments = DB::table('tokenize_payments')
            ->where('user_id', $userId)
            ->where('tokenize_investment_id', $item->id)
            ->orderBy('due_date')
            ->orderBy('installment_no')
            ->get();
        return $item;
    }

    private function summary($items): array
    {
        $total = 0.0;
        $expected = 0.0;
        $received = 0.0;
        $weightedApr = 0.0;
        $active = 0;

        foreach ($items as $item) {
            $amount = (float) $item->investment_amount;
            $total += $amount;
            $expected += $amount * ((float) $item->roi / 100);
            $weightedApr += $amount * (float) $item->apr;
            if ($item->status === 'active') $active++;
            foreach ($item->payments as $payment) {
                if ((bool) $payment->is_paid) $received += (float) $payment->profit_amount;
            }
        }

        return [
            'count' => $items->count(),
            'active_count' => $active,
            'total_investment' => round($total, 2),
            'expected_profit' => round($expected, 2),
            'received_profit' => round($received, 2),
            'weighted_apr' => $total > 0 ? round($weightedApr / $total, 2) : 0,
        ];
    }

    private function userId(Request $request): int
    {
        return max(1, (int) $request->attributes->get('ahmed_user_id', 0));
    }
}
