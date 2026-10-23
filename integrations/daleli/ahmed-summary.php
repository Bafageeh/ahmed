<?php

// This entry point is deployed to the existing COM Ahmed-summary URLs.
// Keep the same profit definition as COM's summary screen: annual hosting
// income minus annualized manual expenses and domain renewals, divided by 24.
function daleliIncomeSummary(float $hostingIncome, float $manualExpenses, float $domainRenewals): array
{
    $annualExpenses = $manualExpenses + $domainRenewals;
    $annualNet = $hostingIncome - $annualExpenses;
    foreach ([$hostingIncome, $annualExpenses, $annualNet] as $value) {
        if (!is_finite($value)) {
            throw new RuntimeException('Invalid aggregate');
        }
    }

    return [
        'com_monthly_person_net' => round($annualNet / 24, 2),
        'com_monthly_net' => round($annualNet / 12, 2),
        'com_annual_net' => round($annualNet, 2),
        'com_hosting_annual_income' => round($hostingIncome, 2),
        'com_annual_expenses' => round($annualExpenses, 2),
    ];
}

if (defined('DALELI_SUMMARY_TEST_ONLY')) {
    return;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    return;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    return;
}

try {
    $base = __DIR__;
    $appPath = PHP_SAPI === 'cli' ? (getenv('DALELI_COM_APP_PATH') ?: null) : null;
    for ($level = 0; $level < 9 && $appPath === null; $level++) {
        foreach ([$base, $base.'/com-api'] as $candidate) {
            if (is_file($candidate.'/vendor/autoload.php') && is_file($candidate.'/bootstrap/app.php')) {
                $appPath = $candidate;
                break 2;
            }
        }
        if (dirname($base) === $base) {
            break;
        }
        $base = dirname($base);
    }
    if ($appPath === null) {
        throw new RuntimeException('Summary application unavailable');
    }
    require_once $appPath.'/vendor/autoload.php';
    $app = require $appPath.'/bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

    // Database aggregates only; never fetch or expose individual financial rows.
    $hostings = Illuminate\Support\Facades\DB::table('hostings')->where('is_blocked', false)
        ->selectRaw('COALESCE(SUM(hosting_cost_sar), 0) AS income, COALESCE(SUM(domain_renewal_cost_sar), 0) AS domains')->first();
    $expenses = Illuminate\Support\Facades\DB::table('expenses')
        ->selectRaw("COALESCE(SUM(CASE WHEN LOWER(COALESCE(billing_cycle, 'yearly')) IN ('monthly', 'شهري') THEN amount_sar * 12 ELSE amount_sar END), 0) AS annual")->value('annual');

    $income = daleliIncomeSummary((float) $hostings->income, (float) $expenses, (float) $hostings->domains);
    echo json_encode([
        'data' => [
            'income' => $income,
            'com_monthly_person_net' => $income['com_monthly_person_net'],
            'com_monthly_net' => $income['com_monthly_net'],
            'com_annual_net' => $income['com_annual_net'],
            'synced_at' => date('c'),
            'source' => 'COM_LIVE_DATABASE',
            'formula' => '(annual income - annual expenses) / 24',
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
} catch (Throwable $exception) {
    http_response_code(503);
    echo json_encode(['message' => 'تعذر تحديث ربح مؤسسة دليلي حاليًا', 'sync_status' => 'unavailable'], JSON_UNESCAPED_UNICODE);
}
