<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MonthlyIncomeController extends Controller
{
    public function index(Request $request)
    {
        $screen = $request->query('screen', 'future');

        return response()->json([
            'data' => DB::table('monthly_incomes')
                ->where('screen', $screen)
                ->orderByDesc('id')
                ->get()
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'screen' => ['nullable', 'string'],
            'name' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        $id = DB::table('monthly_incomes')->insertGetId([
            'screen' => $data['screen'] ?? 'future',
            'name' => $data['name'],
            'amount' => $data['amount'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('monthly_incomes')->where('id', $id)->first()]);
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        DB::table('monthly_incomes')->where('id', $id)->update([
            'name' => $data['name'],
            'amount' => $data['amount'],
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('monthly_incomes')->where('id', $id)->first()]);
    }

    public function destroy(int $id)
    {
        DB::table('monthly_incomes')->where('id', $id)->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }
}
