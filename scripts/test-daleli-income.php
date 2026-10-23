<?php

$root = getenv('DALELI_AHMED_ROOT') ?: dirname(__DIR__);
$staged = getenv('DALELI_STAGED') ?: $root;
require $root.'/ahmed-api/vendor/autoload.php';
$app = require $root.'/ahmed-api/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
require $staged.'/ahmed-api/app/Http/Controllers/Api/MonthlyIncomeController.php';
define('DALELI_SUMMARY_TEST_ONLY', true);
require $staged.'/integrations/daleli/ahmed-summary.php';

function checkDaleli(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$method = new ReflectionMethod(App\Http\Controllers\Api\MonthlyIncomeController::class, 'fetchComMonthlyPersonNet');
$controller = new App\Http\Controllers\Api\MonthlyIncomeController;
$cases = [
    [200, ['data' => ['income' => ['com_monthly_person_net' => 321.45], 'synced_at' => '2026-10-23T12:00:00Z']], 321.45, 'fresh'],
    [200, ['data' => ['income' => ['com_monthly_person_net' => 0]]], 0.0, 'fresh'],
    [200, ['com_monthly_person_net' => -15.25], -15.25, 'fresh'],
    [200, ['data' => ['income' => []]], null, 'unavailable'],
    [500, ['data' => ['com_monthly_person_net' => 999]], null, 'unavailable'],
];
foreach ($cases as [$status, $payload, $amount, $sync]) {
    Illuminate\Support\Facades\Http::swap(new Illuminate\Http\Client\Factory());
    Illuminate\Support\Facades\Http::fake(['com.pm.sa/*' => Illuminate\Support\Facades\Http::response($payload, $status)]);
    $value = $method->invoke($controller);
    checkDaleli($value['amount'] === $amount && $value['sync_status'] === $sync, 'Source value or failure state changed');
}
Illuminate\Support\Facades\Http::swap(new Illuminate\Http\Client\Factory());
Illuminate\Support\Facades\Http::fake(function () {
    throw new Illuminate\Http\Client\ConnectionException('fixture offline');
});
checkDaleli($method->invoke($controller)['amount'] === null, 'Network failure used a fabricated amount');
checkDaleli(daleliIncomeSummary(24000, 6000, 600)['com_monthly_person_net'] === 725.0, 'Live summary formula differs from COM');
checkDaleli(daleliIncomeSummary(0, 0, 0)['com_monthly_person_net'] === 0.0, 'Zero profit must be preserved');
checkDaleli(daleliIncomeSummary(0, 240, 0)['com_monthly_person_net'] === -10.0, 'Losses must not become zero');
checkDaleli(daleliIncomeSummary(26400, 6000, 600)['com_monthly_person_net'] === 825.0, 'Profit changes must change the integration');
echo "DALELI_SOURCE_AND_CLIENT_REGRESSION_TESTS_PASSED\n";
