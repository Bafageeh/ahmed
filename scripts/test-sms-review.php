<?php

require __DIR__.'/test-ta3meed-wallet.php';

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

(require $source.'/ahmed-api/database/migrations/2026_10_26_040000_create_sms_review_approvals.php')->up();
$reviewBaseline = $checks;

function reviewForm(int $id, array $extra = [], ?array $headers = null): array
{
    global $owner;
    [$code, $data] = smsRequest('GET', '/api/sms/messages/'.$id.'/review', [], $headers ?? $owner);
    verifySms($code === 200, 'owner can load the review suggestion');
    return array_replace($data['suggestion'], ['version' => $data['version'], 'mode' => 'new', 'confirmed' => true], $extra);
}
function approveReview(int $id, array $form, ?array $headers = null): array
{
    global $owner;
    return smsRequest('POST', '/api/sms/messages/'.$id.'/approve', $form, $headers ?? $owner);
}

$cash = walletSummary($owner)['summary']['balance_cents'];
[$first] = receivePayment('تم إيداع مبلغ 1.07 عبر تحويل بنكي في محفظتك الاستثمارية في منصة تعميد رقم 8775182 26-10-2026 01:41');
verifySms($first['status'] === 'applied', 'actual Ta3meed wallet message format posts the first cash transfer'); $cash += 107;
[$pending] = receivePayment('تم إيداع مبلغ 1.07 عبر تحويل بنكي في محفظتك الاستثمارية في منصة تعميد رقم 8775182 26-10-2026 03:48');
verifySms($pending['status'] === 'needs_review', 'second equal-value transfer awaits a deliberate review');
$id = $pending['message_id'];
$original = DB::table('sms_archive_messages')->where('id', $id)->first();
[$code] = smsRequest('GET', '/api/sms/messages/'.$id.'/review'); verifySms($code === 401, 'anonymous review is blocked');
[$code] = smsRequest('GET', '/api/sms/messages/'.$id.'/review', [], $other); verifySms($code === 404, 'review does not reveal another account message');
$form = reviewForm($id);
verifySms($form['kind'] === 'deposit' && $form['amount'] === '1.07' && $form['reference'] === '', 'suggestion preserves the amount and never treats account number as operation reference');
[$code] = approveReview($id, $form, $other); verifySms($code === 404, 'spoofed client user-id cannot approve another account message');
[$code] = approveReview($id, array_replace($form, ['confirmed' => false])); verifySms($code === 422, 'explicit review confirmation is required');
[$code] = approveReview($id, array_replace($form, ['version' => str_repeat('0', 64)])); verifySms($code === 409, 'stale archive versions cannot be approved');
[$code, $conflict] = approveReview($id, $form);
verifySms($code === 409 && $conflict['conflict'] && $conflict['candidates'][0]['id'] === $first['wallet_entry_id'], 'possible duplicate is presented before cash changes');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash && DB::table('sms_review_approvals')->count() === 0, 'a conflict commits no approval or cash movement');
[$code] = approveReview($id, $form + ['confirm_duplicate' => true]); verifySms($code === 409, 'duplicate confirmation without its current challenge token is rejected');
$confirmedForm = $form + ['confirm_duplicate' => true, 'duplicate_token' => $conflict['duplicate_token']];
[$code] = approveReview($id, array_replace($confirmedForm, ['amount' => '2.07', 'reference' => 'OTHER']));
verifySms($code === 200, 'corrected genuinely different transfer can be approved without a duplicate conflict');
$cash += 207;
[$code] = approveReview($id, $form); verifySms($code === 409, 'approved message cannot be reinterpreted with a different amount');
$approvedRow = DB::table('sms_archive_messages')->where('id', $id)->first();
verifySms($approvedRow->analysis_status === 'applied' && $approvedRow->analysis_reason === 'manually_approved'
    && $approvedRow->sender === $original->sender && $approvedRow->body === $original->body, 'manual approval resolves the status without changing encrypted original SMS');
[$code, $retry] = approveReview($id, array_replace($confirmedForm, ['amount' => '2.07', 'reference' => 'OTHER']));
verifySms($code === 200 && $retry['replayed'] && walletSummary($owner)['summary']['balance_cents'] === $cash, 'lost successful responses are replayed without a second movement');

[$independent] = receivePayment('تم إيداع مبلغ 1.07 في محفظتك وقت مستقل');
$independentForm = reviewForm($independent['message_id']);
[$code, $conflict] = approveReview($independent['message_id'], $independentForm);
[$code, $posted] = approveReview($independent['message_id'], $independentForm + ['confirm_duplicate' => true, 'duplicate_token' => $conflict['duplicate_token']]);
verifySms($code === 200 && $posted['analysis']['status'] === 'applied', 'user can deliberately approve two independent transfers of equal amount on one day'); $cash += 107;
verifySms(DB::table('sms_review_approvals')->where('message_id', $independent['message_id'])->count() === 1, 'one auditable decision is retained per message');
[$linked] = receivePayment('تم إيداع مبلغ 1.07 في محفظتك رسالة أخرى للربط');
$linkForm = reviewForm($linked['message_id'], ['mode' => 'link', 'link_entry_id' => $first['wallet_entry_id']]);
[$code, $resolved] = approveReview($linked['message_id'], $linkForm);
verifySms($code === 200 && $resolved['analysis']['reason'] === 'manually_linked' && $resolved['analysis']['status'] === 'duplicate', 'linking resolves the review as an already recorded operation');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'linking a message never adds its amount again');
[$code, $relink] = approveReview($linked['message_id'], $linkForm);
verifySms($code === 200 && $relink['replayed'], 'lost link response is idempotent');
[$badLink] = receivePayment('تم إيداع مبلغ 1.07 في محفظتك رابط غير صالح');
$badForm = reviewForm($badLink['message_id'], ['mode' => 'link', 'link_entry_id' => $otherIn['wallet_entry_id']]);
[$code] = approveReview($badLink['message_id'], $badForm); verifySms($code === 409, 'linking to another account movement is blocked');

[$stale] = receivePayment('تم إيداع مبلغ 1.07 في محفظتك اختبار تحديث الحركات');
$staleForm = reviewForm($stale['message_id']);
[$code, $challenge] = approveReview($stale['message_id'], $staleForm);
[$code] = walletManual('deposit', '1.07', ['allow_duplicate' => true]); verifySms($code === 200, 'new movement can arrive while a review remains open'); $cash += 107;
[$code, $refreshed] = approveReview($stale['message_id'], $staleForm + ['confirm_duplicate' => true, 'duplicate_token' => $challenge['duplicate_token']]);
verifySms($code === 409 && $refreshed['duplicate_token'] !== $challenge['duplicate_token'], 'a changed candidate set requires fresh deliberate duplicate confirmation');
[$code] = approveReview($stale['message_id'], array_replace($staleForm, ['entry_date' => '2099-01-01'])); verifySms($code === 422, 'review cannot post a future movement');
[$code] = approveReview($stale['message_id'], array_replace($staleForm, ['amount' => '-1'])); verifySms($code === 422, 'review cannot invert the movement sign');
[$code] = approveReview($stale['message_id'], array_replace($staleForm, ['amount' => '1.001'])); verifySms($code === 422, 'review preserves exact two-decimal money');

[$outReview] = receivePayment('تم سحب مبلغ 33 ريال من محفظتك رسوم 2 ريال');
$outForm = reviewForm($outReview['message_id'], ['amount' => '35']);
[$code, $outResult] = approveReview($outReview['message_id'], $outForm);
verifySms($code === 200 && $outResult['analysis']['action_type'] === 'withdrawal', 'fee-bearing withdrawals can be reviewed and corrected before approval'); $cash -= 3500;
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'approved withdrawal debits the exact confirmed cash amount');

smsOpportunity(40, 'INV-REVIEW40');
[$receiptReview] = receivePayment('تم سداد جزئي بقيمة 27.49 ريال');
$receiptForm = reviewForm($receiptReview['message_id'], ['kind' => 'repayment', 'amount' => '27.49', 'reference' => 'INV-REVIEW40', 'receipt_type' => 'partial']);
[$code, $receiptResult] = approveReview($receiptReview['message_id'], $receiptForm);
verifySms($code === 200 && $receiptResult['analysis']['receipt_id'] && $receiptResult['analysis']['wallet_entry_id'], 'missing opportunity references can be corrected and approved using the real receipt writer'); $cash += 2749;
$receiptId = $receiptResult['analysis']['receipt_id'];
verifySms(round(DB::table('ta3meed_receipt_allocations')->where('receipt_id', $receiptId)->sum('received_amount') * 100) === 2749, 'reviewed repayment updates investor allocations without losing cents');
verifySms(DB::table('investment_opportunities')->where('id', 40)->value('status') === 'partial_received', 'reviewed partial repayment preserves opportunity lifecycle');
[$receiptRepeat] = receivePayment('تم سداد جزئي للفرصة INV-REVIEW40 بقيمة 27.49 ريال بتاريخ '.$day);
$repeatForm = reviewForm($receiptRepeat['message_id']);
[$code, $receiptConflict] = approveReview($receiptRepeat['message_id'], $repeatForm);
verifySms($code === 409 && $receiptConflict['candidates'][0]['linkable'], 'equal repayment shows the existing matching receipt for linking');
[$code] = approveReview($receiptRepeat['message_id'], $repeatForm + ['confirm_duplicate' => true, 'duplicate_token' => $receiptConflict['duplicate_token']]);
verifySms($code === 200 && DB::table('ta3meed_receipts')->where('opportunity_id', 40)->count() === 2, 'confirmed independent partial repayments can coexist'); $cash += 2749;
[$code, $receiptAgain] = approveReview($receiptReview['message_id'], $receiptForm);
verifySms($code === 200 && $receiptAgain['replayed'] && DB::table('ta3meed_receipts')->where('opportunity_id', 40)->count() === 2, 'retry never repeats a reviewed repayment or allocation');
[$excess] = receivePayment('تم سداد جزئي للفرصة INV-REVIEW40 بقيمة 9999 ريال');
$excessForm = reviewForm($excess['message_id']);
[$code] = approveReview($excess['message_id'], $excessForm);
verifySms($code === 422 && DB::table('sms_review_approvals')->where('message_id', $excess['message_id'])->count() === 0, 'approval cannot bypass remaining-principal and opportunity balance protection');

// A failing final audit must roll back the whole approval, including receipt allocations.
[$failure] = receivePayment('تم سداد جزئي بقيمة 19.37 ريال');
$failureForm = reviewForm($failure['message_id'], ['kind' => 'repayment', 'reference' => 'INV-REVIEW40', 'amount' => '19.37']);
$receiptCount = DB::table('ta3meed_receipts')->count(); $allocationCount = DB::table('ta3meed_receipt_allocations')->count();
DB::statement("CREATE TRIGGER fail_review_audit BEFORE INSERT ON sms_review_approvals BEGIN SELECT RAISE(ABORT, 'isolated approval rollback'); END");
[$code] = approveReview($failure['message_id'], $failureForm);
verifySms($code === 500 && DB::table('ta3meed_receipts')->count() === $receiptCount && DB::table('ta3meed_receipt_allocations')->count() === $allocationCount
    && DB::table('sms_archive_messages')->where('id', $failure['message_id'])->value('analysis_status') === 'needs_review', 'failed approval audit rolls back receipt, allocations, wallet and archive status');
DB::statement('DROP TRIGGER fail_review_audit');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'all review outcomes reconcile with wallet cash');
[$code] = approveReview($first['message_id'], $form); verifySms($code === 409, 'automatically completed messages cannot be approved a second time');
DB::table('sms_archive_messages')->where('id', $stale['message_id'])->update(['sender' => Crypt::encryptString('SaudiEnergy')]);
[$code] = approveReview($stale['message_id'], $staleForm);
verifySms($code === 422, 'legacy non-Ta3meed messages cannot be approved');
echo 'SMS_REVIEW_INTEGRATION_PASSED review_checks='.($checks - $reviewBaseline).' total_checks='.$checks."\n";
