<?php

// Verify the real controller against an isolated copy and a private observation plan.
[$script, $root, $database, $controllerFile, $planFile] = $argv;
$plan = json_decode(file_get_contents($planFile), true, 512, JSON_THROW_ON_ERROR);
require $root.'/ahmed-api/vendor/autoload.php';
require $controllerFile;
$app = require $root.'/ahmed-api/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => $database]);
Illuminate\Support\Facades\DB::purge('sqlite');

function checkObservation($condition, $message) {
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

$controller = new App\Http\Controllers\Api\SulfaInvestmentController();
$request = Illuminate\Http\Request::create('/api/sulfa/investment', 'GET');
$request->attributes->set('ahmed_user_id', $plan['user_id']);
$data = $controller->show($request)->getData(true)['data'];
$expected = [];
foreach ($plan['inserts'] as $insert) {
    if ($insert['table'] === 'sulfa_portfolio_snapshots') {
        $values = $insert['values'];
        $metadata = json_decode($values['notes'], true, 512, JSON_THROW_ON_ERROR);
        $expected = array_merge($expected, $metadata['observed'], array_intersect_key($values, array_flip([
            'snapshot_date', 'total_investments', 'outstanding_investments', 'principal_repaid',
        ])));
    }
    if ($insert['table'] === 'sulfa_account_snapshots') {
        $expected = array_merge($expected, array_intersect_key($insert['values'], array_flip([
            'wallet_balance', 'realized_profit', 'realized_profit_percent',
        ])));
    }
    if ($insert['table'] === 'sulfa_investment_transactions') {
        $matches = array_filter($data['transactions'], static function ($row) use ($insert) {
            foreach ($insert['identity'] as $key => $value) {
                if ($row[$key] != $value) return false;
            }
            return true;
        });
        checkObservation(count($matches) === 1, 'Transaction identity was lost or duplicated');
        $row = array_values($matches)[0];
        $sign = $row['transaction_type'] === 'investment' ? -1 : 1;
        checkObservation(abs($row['signed_amount'] - $sign * $row['amount']) < 0.001, 'Incorrect transaction sign');
    }
}
checkObservation(count($expected) === 13, 'Incomplete snapshot test');
foreach ($expected as $key => $value) {
    checkObservation(array_key_exists($key, $data['platform_snapshot']), 'Missing snapshot field');
    checkObservation(is_numeric($value)
        ? abs($data['platform_snapshot'][$key] - $value) < 0.001
        : $data['platform_snapshot'][$key] === $value, 'Snapshot value differs from the observation');
}
checkObservation(count($data['entries']) < $data['platform_snapshot']['opportunity_count'], 'Incomplete opportunity details were invented');
checkObservation(count($data['entries']) === $data['stats']['opportunity_count'], 'Detailed ledger statistics changed scope');
$other = Illuminate\Http\Request::create('/api/sulfa/investment', 'GET');
$other->attributes->set('ahmed_user_id', 2147483647);
$other->headers->set('X-Ahmed-User-Id', (string) $plan['user_id']);
$otherData = $controller->show($other)->getData(true)['data'];
checkObservation($otherData['platform_snapshot'] === null && count($otherData['entries']) === 0
    && count($otherData['transactions']) === 0, 'Snapshot crossed the trusted account boundary');
echo "SULFA_API_SNAPSHOT_LEDGER_AND_ACCOUNT_ISOLATION_VERIFIED\n";
