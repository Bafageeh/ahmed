<?php

// This includes the complete isolated SMS/receipt/allocation suite and its in-memory fixtures.
require __DIR__.'/test-sms-capture.php';

use App\Support\Ta3meedWalletLedger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

Route::prefix('api')->group($source.'/ahmed-api/routes/ta3meed-wallet.php');
$baselineChecks = $checks;
$day = now('Asia/Riyadh')->toDateString();
function walletSummary(array $headers): array
{
    [$code, $response] = smsRequest('GET', '/api/ta3meed/wallet', [], $headers);
    verifySms($code === 200, 'wallet summary is readable by its owner');
    return $response;
}
function walletManual(string $kind, string $amount, array $extra = [], ?array $headers = null): array
{
    global $day, $owner;
    $body = array_replace(['kind' => $kind, 'amount' => $amount, 'entry_date' => $day, 'request_id' => (string) Str::uuid()], $extra);
    [$code, $response] = smsRequest('POST', '/api/ta3meed/wallet/entries', $body, $headers ?? $owner);
    return [$code, $response, $body];
}
[$code] = smsRequest('GET', '/api/ta3meed/wallet'); verifySms($code === 401, 'anonymous wallet access blocked');
$initial = walletSummary($owner);
verifySms($initial['summary']['balance_cents'] === 225000 && $initial['summary']['repayments_cents'] === 225000, 'new repayment receipts credit the wallet exactly once');
verifySms(DB::table('ta3meed_wallet_entries')->where('source', 'receipt')->count() === 4, 'receipt retries do not add wallet credits');
verifySms(walletSummary($other)['summary']['balance_cents'] === 0, 'wallet ownership cannot be changed by a client user header');
smsOpportunity(20, 'INV-WALLET20'); smsOpportunity(21, 'INV-LEGACY21');
DB::table('ta3meed_receipts')->insert(['user_id' => 1, 'opportunity_id' => 21, 'amount' => 100, 'receipt_type' => 'partial', 'receipt_date' => '2026-01-02', 'reference_number' => 'INV-LEGACY21']);
verifySms(walletSummary($owner)['summary']['balance_cents'] === 225000, 'historical unlinked receipts are never imported into opening cash');

[$code, $opening] = walletManual('opening_balance', '1000.00');
verifySms($code === 200 && $opening['summary']['balance_cents'] === 325000 && $opening['summary']['has_opening_balance'], 'manual opening balance');
[$code] = walletManual('opening_balance', '2000'); verifySms($code === 409, 'only one active opening balance per account');
[$code, $deposit, $depositBody] = walletManual('deposit', '250.55');
verifySms($code === 200 && $deposit['summary']['balance_cents'] === 350055, 'manual deposit with cents');
[$code, $retry] = smsRequest('POST', '/api/ta3meed/wallet/entries', $depositBody, $owner);
verifySms($code === 200 && $retry['id'] === $deposit['id'] && $retry['summary']['balance_cents'] === 350055, 'lost manual-save responses are safely idempotent');
[$code] = smsRequest('POST', '/api/ta3meed/wallet/entries', array_replace($depositBody, ['amount' => '999']), $owner);
verifySms($code === 409, 'a request UUID cannot be reused with a conflicting amount');
[$code, $withdrawal] = walletManual('withdrawal', '50.05');
verifySms($code === 200 && $withdrawal['summary']['balance_cents'] === 345050, 'withdrawals reduce cash using exact integer cents');
[$code] = walletManual('deposit', '250.55'); verifySms($code === 409, 'possible duplicate manual deposits require deliberate confirmation');
[$code, $independent] = walletManual('deposit', '250.55', ['allow_duplicate' => true]);
verifySms($code === 200 && $independent['id'] !== $deposit['id'], 'equal legitimate transfers can be explicitly recorded separately');
[$code] = smsRequest('DELETE', '/api/ta3meed/wallet/entries/'.$independent['id'], ['expected_revision' => 1], $owner);
verifySms($code === 200 && DB::table('ta3meed_wallet_entries')->where('id', $independent['id'])->value('voided_at') !== null, 'manual deletion preserves the underlying audit record');
[$code] = smsRequest('PUT', '/api/ta3meed/wallet/entries/'.$deposit['id'], array_replace($depositBody, ['amount' => '260.55', 'expected_revision' => 1]), $owner);
verifySms($code === 200, 'manual movement editing updates cash');
[$code] = smsRequest('PUT', '/api/ta3meed/wallet/entries/'.$deposit['id'], array_replace($depositBody, ['amount' => '999', 'expected_revision' => 1]), $owner);
verifySms($code === 409, 'a stale edit cannot overwrite a newer movement');
[$code] = smsRequest('DELETE', '/api/ta3meed/wallet/entries/'.$deposit['id'], ['expected_revision' => 1], $owner);
verifySms($code === 409, 'a stale delete cannot remove a newer movement');
[$code] = smsRequest('DELETE', '/api/ta3meed/wallet/entries/'.$deposit['id'], ['expected_revision' => 2], $other);
verifySms($code === 404, 'another account cannot delete or inspect a movement');
[$code] = smsRequest('DELETE', '/api/ta3meed/wallet/entries/'.$deposit['id'], ['expected_revision' => 2], $owner);
verifySms($code === 200 && DB::table('ta3meed_wallet_audits')->where('entry_id', $deposit['id'])->count() === 3, 'create, update and void are auditable');
$cash = walletSummary($owner)['summary']['balance_cents'];
verifySms($cash === 319995, 'edited and removed movements leave the correct balance');
[$code] = walletManual('deposit', '1.001'); verifySms($code === 422, 'amounts beyond two decimal places are rejected');
[$code] = walletManual('deposit', '-1'); verifySms($code === 422, 'negative input cannot invert the selected direction');
[$code] = walletManual('deposit', '0'); verifySms($code === 422, 'zero transfers cannot be posted');
[$code] = walletManual('deposit', '1', ['entry_date' => '2099-01-01']); verifySms($code === 422, 'future transactions cannot inflate current cash');
[$code, $zero] = walletManual('opening_balance', '0', [], $other);
verifySms($code === 200 && $zero['summary']['has_opening_balance'] && $zero['summary']['balance_cents'] === 0, 'a deliberately zero opening balance is valid');

[$in, $inPayload] = receivePayment('تم إيداع مبلغ ٢٠٠٫٢٥ ريال في محفظتك بتاريخ '.$day.' رقم العملية DEP-001');
verifySms($in['status'] === 'applied' && $in['action_type'] === 'deposit' && $in['wallet_entry_id'] && str_contains($in['notification']['title'], 'إيداع'), 'confirmed Arabic SMS deposits reach the wallet and return the right completion notification');
$cash += 20025;
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'SMS deposit credits cash once');
[$againIn] = receivePayment($inPayload['body'], $inPayload);
verifySms($againIn['wallet_entry_id'] === $in['wallet_entry_id'] && walletSummary($owner)['summary']['balance_cents'] === $cash, 'native network retries return the same wallet result');
[$duplicate] = receivePayment($inPayload['body'], ['sender' => 'ta3meed']);
verifySms($duplicate['status'] === 'duplicate' && $duplicate['notification'] === null, 'duplicate SMS UUIDs never add a second deposit');
[$duplicate] = receivePayment('تم إيداع مبلغ 200.25 ريال في محفظتك رقم العملية DEP-001');
verifySms($duplicate['status'] === 'duplicate', 'operation references deduplicate wording changes');
[$conflict] = receivePayment('تم إيداع مبلغ 300 ريال في محفظتك رقم العملية DEP-001');
verifySms($conflict['status'] === 'needs_review' && $conflict['reason'] === 'wallet_reference_conflict', 'conflicting amounts under the same transfer reference require review');
[$distinct] = receivePayment('تم إيداع مبلغ 200.25 ريال في محفظتك رقم العملية DEP-002');
verifySms($distinct['status'] === 'applied', 'distinct explicit transfer references permit equal-value deposits'); $cash += 20025;
[$out] = receivePayment('تم سحب مبلغ 25.10 ريال من محفظتك رقم العملية OUT-001');
verifySms($out['status'] === 'applied' && $out['action_type'] === 'withdrawal' && str_contains($out['notification']['title'], 'سحب'), 'completed SMS withdrawals debit the wallet'); $cash -= 2510;
[$bank] = receivePayment('تم تحويل مبلغ 30 ريال من محفظتك إلى حسابك البنكي رقم العملية BANK-002');
verifySms($bank['status'] === 'applied' && $bank['action_type'] === 'withdrawal', 'completed wallet-to-bank transfers are outgoing cash'); $cash -= 3000;
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'SMS inflow and outflow totals reconcile');
foreach ([
    'تم تقديم طلب سحب مبلغ 99 ريال من محفظتك',
    'سيتم إيداع مبلغ 99 ريال في محفظتك',
    'لم يتم سحب مبلغ 99 ريال من محفظتك',
    'تم إيداع مبلغ 0 ريال في محفظتك',
    'تم سحب وإيداع مبلغ 99 ريال في محفظتك',
    'تم إيداع مبلغ 10.123 ريال في محفظتك',
    'تم سحب مبلغ 10 ريال من محفظتك رسوم 2 ريال',
    'تم إيداع مبلغ 100 ريال في حسابك البنكي',
] as $body) {
    [$review] = receivePayment($body);
    verifySms($review['status'] !== 'applied', 'pending, ambiguous, fee-bearing or non-wallet transfers cannot change cash');
}
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'reviewed or pending messages preserve cash');
[$code, $manual] = walletManual('deposit', '77.00'); verifySms($code === 200, 'manual transfer recorded before a matching SMS'); $cash += 7700;
[$possible] = receivePayment('تم إيداع مبلغ 77 ريال في محفظتك');
verifySms($possible['status'] === 'needs_review' && $possible['reason'] === 'possible_duplicate_wallet_transfer', 'a matching manual movement is never counted again from SMS');
[$possibleReceipt] = receivePayment('تم سداد جزئي للفرصة INV-WALLET20 بقيمة 77 ريال');
verifySms($possibleReceipt['status'] === 'needs_review' && $possibleReceipt['reason'] === 'possible_duplicate_wallet_transfer'
    && DB::table('investment_opportunities')->where('id', 20)->value('status') === 'active', 'a repayment arriving after an equal generic deposit is held before either receipt or wallet is changed');
[$code, $otherDevice] = smsRequest('POST', '/api/sms/devices', ['installation_id' => (string) Str::uuid()], $other);
[$otherIn] = receivePayment($inPayload['body'], [], ['X-Ahmed-SMS-Token' => $otherDevice['upload_token']]);
verifySms($otherIn['status'] === 'applied' && walletSummary($other)['summary']['balance_cents'] === 20025, 'reference deduplication and wallet cash are account scoped');

// Receipt date edits and deletions remain authoritative; no mirrored cash snapshots drift.
$receiptId = $partial['receipt_id'];
DB::table('ta3meed_receipts')->where('id', $receiptId)->update(['receipt_date' => '2026-01-03']);
$view = walletSummary($owner);
$linked = collect($view['data'])->firstWhere('receipt_id', $receiptId);
verifySms($linked['entry_date'] === '2026-01-03' && $view['summary']['balance_cents'] === $cash, 'editing a linked receipt date updates its wallet date without changing cash');
[$code] = smsRequest('DELETE', '/api/ta3meed/wallet/entries/'.$in['wallet_entry_id'], ['expected_revision' => 1], $owner);
verifySms($code === 422, 'an imported SMS entry cannot be silently rewritten as a manual entry');
DB::table('ta3meed_receipts')->where('id', $receiptId)->delete(); $cash -= 10075;
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'deleting a receipt removes its linked credit from the balance');

$beforeReceipts = DB::table('ta3meed_receipts')->count();
DB::statement("CREATE TRIGGER fail_wallet_entry BEFORE INSERT ON ta3meed_wallet_entries BEGIN SELECT RAISE(ABORT, 'isolated wallet rollback test'); END");
[$failedDeposit] = receivePayment('تم إيداع مبلغ 123.45 ريال في محفظتك رقم العملية FAIL-001');
verifySms($failedDeposit['status'] === 'needs_review' && $failedDeposit['reason'] === 'processing_failed', 'failed wallet writes never report success');
[$failedRepayment] = receivePayment('تم سداد جزئي للفرصة INV-WALLET20 بقيمة 123 ريال');
verifySms($failedRepayment['status'] === 'needs_review' && DB::table('ta3meed_receipts')->count() === $beforeReceipts
    && DB::table('investment_opportunities')->where('id', 20)->value('status') === 'active', 'a failed wallet credit rolls back its receipt and investor allocation');
DB::statement('DROP TRIGGER fail_wallet_entry');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'failed transactions leave the previous wallet total intact');
[$code, $filtered] = smsRequest('GET', '/api/ta3meed/wallet?kind=withdrawal', [], $owner);
verifySms($code === 200 && collect($filtered['data'])->every(fn ($row) => $row['amount_cents'] < 0)
    && $filtered['summary']['balance_cents'] === $cash, 'movement filters do not change the overall cash balance');
echo 'TA3MEED_WALLET_INTEGRATION_PASSED wallet_checks='.($checks - $baselineChecks).' total_checks='.$checks."\n";
