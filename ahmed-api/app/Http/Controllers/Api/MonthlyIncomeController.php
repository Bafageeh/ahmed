<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

class MonthlyIncomeController extends Controller
{
    private string $comSummaryUrl = 'https://com.pm.sa/api/v1/integrations/ahmed/summary/';

    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $screen = $this->screenKey((string) $request->query('screen', 'future'));

        $items = DB::table('monthly_incomes')
            ->where('user_id', $userId)
            ->where('screen', $screen)
            ->orderByDesc('id')
            ->get();

        // COM currently points to the administrator's external account. It must
        // never be exposed as a fixed value in another user's monthly income.
        if ($screen === 'future' && $this->isAdmin($request)) {
            $items->prepend((object) [
                'id' => 'fixed-com-monthly-person-net',
                'user_id' => $userId,
                'screen' => 'future',
                'name' => 'صافي الشخص الشهري من COM',
                'amount' => $this->fetchComMonthlyPersonNet(),
                'readonly' => true,
                'display_source' => 'com',
                'external_app_key' => 'com',
                'source_key' => 'com_monthly_person_net',
                'created_at' => null,
                'updated_at' => now()->toDateTimeString(),
            ]);
        }

        return response()->json(['data' => $items->values()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'screen' => ['nullable', 'string', 'max:80'],
            'name' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        $userId = $this->userId($request);
        $screen = $this->screenKey((string) ($data['screen'] ?? 'future'));

        $id = DB::table('monthly_incomes')->insertGetId([
            'user_id' => $userId,
            'screen' => $screen,
            'name' => $data['name'],
            'amount' => $data['amount'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('monthly_incomes')
                ->where('id', $id)
                ->where('user_id', $userId)
                ->first(),
        ]);
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        $userId = $this->userId($request);
        $updated = DB::table('monthly_incomes')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->update([
                'name' => $data['name'],
                'amount' => $data['amount'],
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'سجل الدخل غير موجود'], 404);
        }

        return response()->json([
            'data' => DB::table('monthly_incomes')
                ->where('id', $id)
                ->where('user_id', $userId)
                ->first(),
        ]);
    }

    public function destroy(Request $request, int|string $id)
    {
        if ($id === 'fixed-com-monthly-person-net') {
            return response()->json(['data' => ['deleted' => false, 'readonly' => true]]);
        }

        $deleted = DB::table('monthly_incomes')
            ->where('id', $id)
            ->where('user_id', $this->userId($request))
            ->delete();

        return response()->json(['data' => ['deleted' => (bool) $deleted]]);
    }

    private function screenKey(string $screen): string
    {
        $screen = trim($screen);
        if (preg_match('/^wealth-\d+$/', $screen)) {
            return 'wealth';
        }

        return $screen !== '' ? $screen : 'future';
    }

    private function userId(Request $request): int
    {
        $userId = (int) $request->attributes->get('ahmed_user_id', 0);
        abort_unless($userId > 0, 401, 'يجب تسجيل الدخول أولاً');
        return $userId;
    }

    private function isAdmin(Request $request): bool
    {
        $user = $request->attributes->get('ahmed_user');
        if (Schema::hasColumn('users', 'is_admin')) {
            return (bool) ($user->is_admin ?? false);
        }

        return (int) ($user->id ?? 0) === (int) (DB::table('users')->orderBy('id')->value('id') ?: 0);
    }

    private function fetchComMonthlyPersonNet(): float
    {
        try {
            $response = Http::timeout(10)->acceptJson()->get($this->comSummaryUrl);
            $json = $response->json();
            $data = is_array($json) ? ($json['data'] ?? $json) : [];
            $income = is_array($data['income'] ?? null) ? $data['income'] : [];
            $value = $income['com_monthly_person_net'] ?? $data['com_monthly_person_net'] ?? null;

            if (is_numeric($value)) {
                return round((float) $value, 2);
            }
        } catch (\Throwable $exception) {
            // keep fallback below for the administrator account only
        }

        return 614.95;
    }
}
