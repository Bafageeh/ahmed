<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DebtDashboardController extends Controller
{
    public function __construct(private DebtController $debts)
    {
    }

    public function index(Request $request)
    {
        $response = $this->debts->index($request);
        $payload = $response->getData(true);
        $summary = $payload['summary'] ?? [];
        $userId = (int) $request->attributes->get('ahmed_user_id');

        $creditCardsTotal = Schema::hasTable('credit_card_debts')
            ? (float) DB::table('credit_card_debts')->where('user_id', $userId)->sum('credit_limit')
            : 0.0;
        $creditCardsCount = Schema::hasTable('credit_card_debts')
            ? DB::table('credit_card_debts')->where('user_id', $userId)->count()
            : 0;

        $totalOriginal = (float) ($summary['total_original'] ?? 0) + $creditCardsTotal;
        $totalRemaining = (float) ($summary['total_remaining'] ?? 0) + $creditCardsTotal;
        $totalPaid = (float) ($summary['total_paid'] ?? 0);

        $summary['loan_debts_total'] = round((float) ($summary['total_original'] ?? 0), 2);
        $summary['credit_cards_total'] = round($creditCardsTotal, 2);
        $summary['credit_cards_count'] = $creditCardsCount;
        $summary['total_original'] = round($totalOriginal, 2);
        $summary['total_remaining'] = round($totalRemaining, 2);
        $summary['progress_percent'] = $totalOriginal > 0
            ? round(($totalPaid / $totalOriginal) * 100, 2)
            : 0;

        $payload['summary'] = $summary;

        return response()->json($payload, $response->getStatusCode());
    }
}
