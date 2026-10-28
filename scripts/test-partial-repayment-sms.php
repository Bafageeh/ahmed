<?php

// Exercise the complete SMS, wallet, manual review and investment funding regressions first.
$partialSuiteComplete = false;
register_shutdown_function(static function () use (&$partialSuiteComplete): void {
    if (! $partialSuiteComplete) { fwrite(STDERR, "Partial repayment SMS suite did not finish\n"); exit(1); }
});
require __DIR__.'/test-sms-investment-funding.php';

use App\Http\Controllers\Api\Ta3meedReceiptController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

$partialBaseline = $checks;
function partialFinancialState(): array
{
    $result = [];
    foreach (['investment_opportunities', 'investment_opportunity_allocations', 'ta3meed_receipts',
        'ta3meed_receipt_allocations', 'ta3meed_wallet_entries', 'ta3meed_wallet_audits'] as $table) {
        $result[$table] = hash('sha256', json_encode(DB::table($table)->orderBy('id')->get()));
    }
    return $result;
}
function partialManualReceipt(int $opportunityId, string $amount, string $date, int $userId = 1): int
{
    $request = Request::create('/synthetic/manual-receipt', 'POST', [
        'amount' => $amount, 'receipt_type' => 'partial', 'receipt_date' => $date,
    ]);
    $request->attributes->set('ahmed_user_id', $userId);
    $response = app(Ta3meedReceiptController::class)->store($request, $opportunityId);
    $data = json_decode($response->getContent(), true);
    verifySms($response->getStatusCode() === 200 && ! $data['data']['receipt']['duplicate'], 'synthetic manual receipt uses the real receipt and allocation writer');
    return (int) $data['data']['receipt']['id'];
}

smsOpportunity(10001, 'ER-AUTO10001');
$body = 'مرحبا أحمد، تم إضافة سداد جزئي بقيمة ٦٧٫١٩ للفرصة رقم ER-AUTO10001 إلى محفظتك الاستثمارية شكرا لثقتك منصة تعميد';
$sent = (new DateTimeImmutable('2026-10-20T21:30:00Z'))->getTimestamp() * 1000;
[$first, $payload] = receivePayment($body, ['sent_at_ms' => $sent]);
verifySms($first['status'] === 'applied' && $first['receipt_id'] && $first['wallet_entry_id'], 'actual added-partial wording is automatically applied without a manual review');
$receipt = DB::table('ta3meed_receipts')->where('id', $first['receipt_id'])->first();
verifySms($receipt->receipt_date === '2026-10-21' && (int) round($receipt->amount * 100) === 6719
    && $receipt->receipt_type === 'partial', 'Arabic money and the original sent date use the Riyadh calendar day');
verifySms((int) round(DB::table('ta3meed_receipt_allocations')->where('receipt_id', $receipt->id)->sum('received_amount') * 100) === 6719
    && DB::table('investment_opportunities')->where('id', 10001)->value('status') === 'partial_received', 'automatic partial receipt updates real investor shares and opportunity balance');

$state = partialFinancialState();
[$retry] = receivePayment($body, $payload);
verifySms($retry['receipt_id'] === $first['receipt_id'] && partialFinancialState() === $state, 'a lost ingestion response cannot repeat the receipt, cash or allocations');
[$changedWording] = receivePayment('تم سداد جزئي للفرصة ER-AUTO10001 بمبلغ 67.19 ريال بتاريخ 21/10/2026');
verifySms($changedWording['status'] === 'duplicate' && $changedWording['receipt_id'] === $receipt->id
    && $changedWording['wallet_entry_id'] === $first['wallet_entry_id'] && $changedWording['notification'] === null
    && partialFinancialState() === $state, 'same opportunity, amount and date deduplicate different message text without a success alert');
[$crossDevice] = receivePayment('تم اضافة سداد جزئي بقيمة 67.19 للفرصة رقم er-auto10001 بتاريخ 2026-10-21', [], ['X-Ahmed-SMS-Token' => $secondDevice['upload_token']]);
verifySms($crossDevice['status'] === 'duplicate' && $crossDevice['receipt_id'] === $receipt->id && partialFinancialState() === $state, 'another device and spelling variation cannot repeat the same partial payment');

[$nextDay] = receivePayment($body, ['sent_at_ms' => $sent + 86400000]);
verifySms($nextDay['status'] === 'applied' && $nextDay['receipt_id'] !== $first['receipt_id']
    && DB::table('ta3meed_receipts')->where('id', $nextDay['receipt_id'])->value('receipt_date') === '2026-10-22', 'identical partial text and amount on a different payment date create a new receipt');
[$differentAmount] = receivePayment('تم إضافة سداد جزئي بقيمة 67.20 للفرصة رقم ER-AUTO10001 بتاريخ 2026-10-21');
verifySms($differentAmount['status'] === 'applied', 'a different amount on the same opportunity and date is a separate partial payment');
smsOpportunity(10002, 'ER-AUTO10002');
[$otherOpportunity] = receivePayment('تم إضافة سداد جزئي بقيمة 67.19 للفرصة رقم ER-AUTO10002 بتاريخ 2026-10-21');
verifySms($otherOpportunity['status'] === 'applied', 'a receipt from a different opportunity cannot suppress an equal payment on the same date');

smsOpportunity(10003, 'ER-MANUAL10003');
$manualId = partialManualReceipt(10003, '58.31', '2026-10-21');
verifySms(DB::table('ta3meed_receipts')->where('id', $manualId)->value('source_message') === null, 'manual fixture has no SMS text');
$state = partialFinancialState();
[$manualMatch] = receivePayment('تم إضافة سداد جزئي بقيمة 58.31 للفرصة رقم ER-MANUAL10003 بتاريخ 2026-10-21');
verifySms($manualMatch['status'] === 'duplicate' && $manualMatch['receipt_id'] === $manualId && partialFinancialState() === $state, 'an equal manually entered receipt is linked without posting its cash again');
[$manualDifferentDay] = receivePayment('تم إضافة سداد جزئي بقيمة 58.31 للفرصة رقم ER-MANUAL10003 بتاريخ 2026-10-22');
verifySms($manualDifferentDay['status'] === 'applied', 'an equal manual receipt on another date does not block a new SMS partial repayment');

smsOpportunity(10004, 'ER-OWNER10004', 2);
partialManualReceipt(10004, '73.11', '2026-10-21', 2);
smsOpportunity(10005, 'ER-OWNER10004');
[$ownPayment] = receivePayment('تم إضافة سداد جزئي بقيمة 73.11 للفرصة رقم ER-OWNER10004 بتاريخ 2026-10-21');
verifySms($ownPayment['status'] === 'applied'
    && (int) DB::table('ta3meed_receipts')->where('id', $ownPayment['receipt_id'])->value('opportunity_id') === 10005, 'matching references and amounts in another account never block the authenticated owner');

$state = partialFinancialState();
foreach ([
    'سيتم إضافة سداد جزئي بقيمة 21 للفرصة رقم ER-AUTO10001',
    'لم يتم إضافة سداد جزئي بقيمة 21 للفرصة رقم ER-AUTO10001',
    'تعذر إضافة سداد جزئي للفرصة ER-AUTO10001 بقيمة 21',
    'طلب إضافة سداد جزئي للفرصة ER-AUTO10001 بقيمة 21',
    'تم إضافة سداد جزئي بقيمة 21 للفرصة رقم ER-AUTO10001 بتاريخ 2099-01-01',
    'تم إضافة سداد جزئي بقيمة 21 للفرصة رقم ER-AUTO10001 بتاريخ 2026-02-30',
    'تم إضافة سداد جزئي بقيمة 21.123 للفرصة رقم ER-AUTO10001',
    'تم إضافة سداد جزئي بقيمة 21 ومبلغ 22 للفرصة رقم ER-AUTO10001',
    'تم إضافة سداد جزئي بقيمة 21 للفرصة رقم ER-AUTO10001 والفرصة رقم ER-AUTO10002',
    'تم إضافة سداد جزئي وكامل بقيمة 21 للفرصة رقم ER-AUTO10001 بالكامل',
    'تم إضافة سداد جزئي بقيمة 9999 للفرصة رقم ER-AUTO10001',
] as $unsafe) {
    [$outcome] = receivePayment($unsafe);
    verifySms(! in_array($outcome['status'], ['applied', 'duplicate'], true) && partialFinancialState() === $state, 'unconfirmed, ambiguous or excessive partial repayments never alter financial data');
}
[$fullConflict] = receivePayment('تم سداد كلي للفرصة ER-MANUAL10003 بقيمة 58.31 ريال بتاريخ 2026-10-21');
verifySms($fullConflict['status'] === 'needs_review' && $fullConflict['reason'] === 'possible_duplicate_receipt'
    && partialFinancialState() === $state, 'the new partial policy preserves existing full-settlement review rules');
verifySms(DB::table('investment_opportunities')->where('id', 10001)->value('start_date') === '2026-01-01', 'automatic added-partial payments preserve the funding date');

$partialSuiteComplete = true;
echo 'PARTIAL_REPAYMENT_SMS_INTEGRATION_PASSED partial_checks='.($checks - $partialBaseline).' total_checks='.$checks."\n";
