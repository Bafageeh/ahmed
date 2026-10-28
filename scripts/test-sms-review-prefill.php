<?php

$prefillComplete = false;
register_shutdown_function(static function () use (&$prefillComplete): void {
    if (! $prefillComplete) { fwrite(STDERR, "SMS prefill suite did not finish successfully\n"); exit(1); }
});
require __DIR__.'/test-sms-review.php';

use App\Support\Ta3meedSmsReviewData;
use Illuminate\Support\Facades\DB;

$prefillBaseline = $checks;
function extractedReview(string $body): array
{
    return Ta3meedSmsReviewData::extract($body, '2026-10-25', 'received_at');
}
$sample = extractedReview('مرحبا أحمد، تم إضافة سداد جزئي بقيمة 2724.09 للفرصة رقم ER-TEST237 إلى محفظتك الاستثمارية شكرا لثقتك منصة تعميد');
verifySms($sample['suggestion'] === ['kind' => 'repayment', 'amount' => '2724.09', 'entry_date' => '2026-10-25', 'reference' => 'ER-TEST237', 'receipt_type' => 'partial'], 'the reported SMS wording prefills every fact independently of automatic completion recognition');
verifySms($sample['missing_fields'] === [] && $sample['sources']['entry_date'] === 'received_at', 'complete SMS needs no manual fields and labels its timestamp date');
$missingRef = extractedReview('تم سداد جزئي بقيمة 27.49 ريال');
verifySms($missingRef['missing_fields'] === ['reference'] && $missingRef['suggestion']['amount'] === '27.49' && $missingRef['suggestion']['receipt_type'] === 'partial', 'missing reference does not discard known amount or type');
$missingAmount = extractedReview('تم إضافة سداد جزئي للفرصة رقم ER-TEST237');
verifySms($missingAmount['missing_fields'] === ['amount'] && $missingAmount['suggestion']['reference'] === 'ER-TEST237', 'missing amount does not discard known reference');
$missingType = extractedReview('تم إضافة سداد بقيمة 27.49 للفرصة رقم ER-TEST237');
verifySms($missingType['missing_fields'] === ['receipt_type'] && $missingType['suggestion']['receipt_type'] === '', 'unspecified payment type is requested instead of silently defaulting to partial');
$multipleRefs = extractedReview('تم سداد جزئي للفرصة INV-TEST237 والفرصة INV-TEST238 بقيمة 27.49 ريال');
verifySms($multipleRefs['suggestion']['reference'] === '' && $multipleRefs['suggestion']['amount'] === '27.49', 'ambiguous references leave amount available and request reference only');
$multipleAmounts = extractedReview('تم سداد جزئي للفرصة ER-TEST237 بقيمة 27.49 ومبلغ 8.00 ريال');
verifySms($multipleAmounts['suggestion']['amount'] === '' && $multipleAmounts['suggestion']['reference'] === 'ER-TEST237', 'ambiguous amounts do not erase reference');
$arabic = extractedReview('تم إضافة سداد جزئي بقيمة ٢٬٧٢٤٫٠٩ للفرصة رقم ER-TEST٢٣٧ بتاريخ ٢٥/١٠/٢٠٢٦');
verifySms($arabic['suggestion']['amount'] === '2724.09' && $arabic['suggestion']['reference'] === 'ER-TEST237' && $arabic['suggestion']['entry_date'] === '2026-10-25', 'Arabic digits and separators normalize without losing cents');
$persian = extractedReview('تم إضافة سداد جزئي بقيمة ۲۷٫۴۹ للفرصة رقم ER-TEST۲۳۷');
verifySms($persian['suggestion']['amount'] === '27.49' && $persian['suggestion']['reference'] === 'ER-TEST237', 'Persian digits normalize');
foreach (['2026-02-31', '2099-01-01', '2026-10-25 وتاريخ 2026-10-24'] as $badDate) {
    $bad = extractedReview('تم إضافة سداد جزئي بقيمة 27.49 للفرصة رقم ER-TEST237 بتاريخ '.$badDate);
    verifySms($bad['suggestion']['entry_date'] === '' && $bad['missing_fields'] === ['entry_date'] && $bad['suggestion']['amount'] === '27.49', 'an explicit invalid or ambiguous date is requested without losing other fields');
}
$deposit = extractedReview('تم إيداع مبلغ 1.07 عبر تحويل بنكي في محفظتك الاستثمارية في منصة تعميد رقم 0000001 25-10-2026 03:48');
verifySms($deposit['suggestion']['kind'] === 'deposit' && $deposit['suggestion']['amount'] === '1.07' && $deposit['suggestion']['entry_date'] === '2026-10-25' && $deposit['suggestion']['reference'] === '' && $deposit['missing_fields'] === [], 'a bank account number is never a transfer reference and optional wallet reference is not requested');
$withdrawal = extractedReview('تم سحب مبلغ 12.38 ريال من محفظتك مرجع العملية TX123 بتاريخ 25/10/2026');
verifySms($withdrawal['suggestion']['kind'] === 'withdrawal' && $withdrawal['suggestion']['reference'] === 'TX123' && $withdrawal['missing_fields'] === [], 'withdrawal facts prefill independently');
$fees = extractedReview('تم سحب مبلغ 12.38 ريال من محفظتك رسوم 2 ريال');
verifySms($fees['suggestion']['amount'] === '' && $fees['missing_fields'] === ['amount'], 'a fee-bearing withdrawal requests the actual debit rather than guessing');
$conflictingType = extractedReview('تم إضافة سداد جزئي وكامل بقيمة 27.49 للفرصة رقم ER-TEST237 بالكامل');
verifySms($conflictingType['suggestion']['receipt_type'] === '' && $conflictingType['suggestion']['amount'] === '27.49', 'conflicting repayment types leave only type for resolution');
$unrelated = extractedReview('تم تحديث بيانات محفظتك بنجاح');
verifySms($unrelated['suggestion']['kind'] === '' && $unrelated['suggestion']['receipt_type'] === '', 'unrelated text cannot fabricate repayment defaults');

smsOpportunity(50, 'ER-PREFILL50');
$beforeCash = walletSummary($owner)['summary']['balance_cents'];
$beforeReceipts = DB::table('ta3meed_receipts')->count();
[$pendingPrefill, $payload] = receivePayment('إشعار سداد جزئي بقيمة 41.83 للفرصة رقم ER-PREFILL50 إلى محفظتك الاستثمارية');
verifySms($pendingPrefill['status'] === 'needs_review' && $pendingPrefill['reason'] === 'payment_not_confirmed', 'unconfirmed wording still requires review despite complete extracted facts');
$prefillId = $pendingPrefill['message_id'];
[$code, $review] = smsRequest('GET', '/api/sms/messages/'.$prefillId.'/review', [], $owner);
verifySms($code === 200 && $review['suggestion']['amount'] === '41.83' && $review['suggestion']['reference'] === 'ER-PREFILL50' && $review['suggestion']['receipt_type'] === 'partial' && $review['missing_fields'] === [], 'authenticated review fills real archived SMS without manual retyping');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $beforeCash && DB::table('ta3meed_receipts')->count() === $beforeReceipts, 'loading review suggestions never writes financial data');
$readyForm = $review['suggestion'] + ['version' => $review['version'], 'mode' => 'new', 'confirmed' => true];
[$code, $approvedPrefill] = approveReview($prefillId, $readyForm);
verifySms($code === 200 && $approvedPrefill['analysis']['status'] === 'applied' && walletSummary($owner)['summary']['balance_cents'] === $beforeCash + 4183, 'the unchanged prefilled decision posts exact cash through the existing approval transaction');
$receiptId = $approvedPrefill['analysis']['receipt_id'];
verifySms((int) round(DB::table('ta3meed_receipt_allocations')->where('receipt_id', $receiptId)->sum('received_amount') * 100) === 4183, 'prefilled approval records actual investor allocations');
[$code, $retry] = approveReview($prefillId, $readyForm);
verifySms($code === 200 && $retry['replayed'] && walletSummary($owner)['summary']['balance_cents'] === $beforeCash + 4183, 'prefilled retries retain the existing idempotency protection');
$prefillComplete = true;
echo 'SMS_REVIEW_PREFILL_INTEGRATION_PASSED prefill_checks='.($checks - $prefillBaseline).' total_checks='.$checks."\n";
