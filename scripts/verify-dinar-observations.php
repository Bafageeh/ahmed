<?php

// Validate image-derived records through the existing, account-scoped application API.
[$script, $root, $database, $planFile] = $argv;
$plan = json_decode(file_get_contents($planFile), true, 512, JSON_THROW_ON_ERROR);
require $root.'/ahmed-api/vendor/autoload.php';
$app = require $root.'/ahmed-api/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => $database]);
Illuminate\Support\Facades\DB::purge('sqlite');

function requireDinarObservation($condition, $message) {
    if (! $condition) throw new RuntimeException($message);
}

$request = Illuminate\Http\Request::create('/api/dinar/investments', 'GET');
$request->attributes->set('ahmed_user_id', $plan['user_id']);
$request->attributes->set('ahmed_user', Illuminate\Support\Facades\DB::table('users')->where('id', $plan['user_id'])->first());
$request->headers->set('X-Ahmed-User-Id', (string) $plan['user_id']);
$controller = new App\Http\Controllers\Api\TenantDinarInvestmentController();
$payload = $controller->index($request)->getData(true);
foreach ($plan['expected'] as $field => $value) {
    $actual = $field === 'monthly_income'
        ? round($payload['summary']['total_investment'] * 0.12 / 12, 2)
        : ($payload['summary'][$field] ?? null);
    requireDinarObservation($actual !== null && abs($actual - $value) < 0.001, 'Portfolio summary differs from the image evidence');
}
$investments = [];
foreach ($payload['data'] as $item) $investments[$item['external_key']] = $item;
foreach (['paid' => true, 'unpaid' => false] as $kind => $paid) {
    foreach ($plan['observations'][$kind] as [$key, $number, $dueDate, $combined]) {
        $rows = array_values(array_filter($investments[$key]['payments'], static fn ($p) => (int) $p['installment_no'] === $number));
        requireDinarObservation(count($rows) === 1, 'Observed payment is missing or duplicated');
        $payment = $rows[0];
        requireDinarObservation((bool) $payment['is_paid'] === $paid && $payment['due_date'] === $dueDate, 'Payment status or date differs');
        requireDinarObservation(abs($payment['total_distribution'] + $payment['total_principal'] - $combined) < 0.001, 'Payment principal and distribution were mixed');
    }
}
foreach ($plan['inserts'] as $insert) {
    $query = Illuminate\Support\Facades\DB::table($insert['table']);
    foreach ($insert['identity'] as $key => $value) $query->where($key, $value);
    requireDinarObservation($query->count() === 1, 'Financial transaction is missing or duplicated');
}
$other = Illuminate\Http\Request::create('/api/dinar/investments', 'GET');
$other->attributes->set('ahmed_user_id', 2147483647);
$other->attributes->set('ahmed_user', (object) ['id' => 2147483647, 'is_admin' => false]);
$other->headers->set('X-Ahmed-User-Id', (string) $plan['user_id']);
$empty = $controller->index($other)->getData(true);
requireDinarObservation(count($empty['data']) === 0 && count($empty['unlinked_payments']) === 0
    && $empty['summary']['total_investment'] == 0, 'Dinar data crossed an account boundary');
if (isset($argv[4])) {
    file_put_contents($argv[4], json_encode($payload, JSON_THROW_ON_ERROR));
    chmod($argv[4], 0600);
}
echo "DINAR_API_CAPITAL_SCHEDULE_TRANSACTIONS_AND_ACCOUNT_ISOLATION_VERIFIED\n";
