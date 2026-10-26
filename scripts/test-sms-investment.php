<?php

$investmentSuiteComplete = false;
register_shutdown_function(static function () use (&$investmentSuiteComplete): void {
    if (! $investmentSuiteComplete) { fwrite(STDERR, "SMS investment suite did not finish\n"); exit(1); }
});
require __DIR__.'/test-sms-review-prefill.php';

use App\Support\Ta3meedInvestmentSmsParser;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

(require $source.'/ahmed-api/database/migrations/2026_10_26_120000_add_sms_investment_decisions.php')->up();
if (! Schema::hasTable('ta3meed_investor_audits')) (require $source.'/ahmed-api/database/migrations/2026_10_21_230000_create_ta3meed_investor_audits_table.php')->up();
$investmentBaseline = $checks;
function investmentReview(int $id, ?array $headers = null): array
{
    global $owner;
    [$code, $result] = smsRequest('GET', '/api/sms/messages/'.$id.'/investment', [], $headers ?? $owner);
    verifySms($code === 200, 'owner can open accepted investment review');
    return $result;
}
function finishInvestment(int $id, array $data, ?array $headers = null): array
{
    global $owner;
    return smsRequest('POST', '/api/sms/messages/'.$id.'/investment/complete', $data, $headers ?? $owner);
}
function cancelInvestment(int $id, string $version, ?array $headers = null): array
{
    global $owner;
    return smsRequest('POST', '/api/sms/messages/'.$id.'/investment/dismiss', ['version' => $version], $headers ?? $owner);
}
function opportunityCount(): int { return DB::table('investment_opportunities')->count(); }

$cashBeforeInvestment = walletSummary($owner)['summary']['balance_cents'];
$opportunitiesBefore = opportunityCount();
$receiptsBefore = DB::table('ta3meed_receipts')->count();
$body = 'تم قبول استثمارك بمبلغ 50001.00 في الفرصة رقم ER-ACCEPT900 وتستطيع الغاء الاستثمار خلال 48 ساعة من وقت طرح الفرصة من داخل حسابك في المنصة';
verifySms(Ta3meedInvestmentSmsParser::recognizes($body), '48-hour cancellation instructions remain a pending acceptance');
foreach (['سيتم قبول استثمارك بمبلغ 50', 'لم يتم قبول استثمارك بمبلغ 50', 'لم يتم تأكيد استثمارك', 'تم إلغاء استثمارك بمبلغ 50', 'تم سداد جزئي للفرصة INV-TEST1 بقيمة 50'] as $negative) {
    verifySms(! Ta3meedInvestmentSmsParser::recognizes($negative), 'future, rejected, cancelled and repayment messages are not accepted-investment drafts');
}
[$accepted, $acceptedPayload] = receivePayment($body);
$acceptId = $accepted['message_id'];
verifySms($accepted['status'] === 'needs_review' && $accepted['action_type'] === 'investment' && $accepted['reference_number'] === 'ER-ACCEPT900', 'acceptance appears as pending completion');
verifySms(opportunityCount() === $opportunitiesBefore && DB::table('ta3meed_receipts')->count() === $receiptsBefore && walletSummary($owner)['summary']['balance_cents'] === $cashBeforeInvestment, 'receiving acceptance creates no investment, receipt or cash movement');
$review = investmentReview($acceptId);
verifySms($review['suggestion']['code'] === 'ER-ACCEPT900' && $review['suggestion']['total_amount'] === '50001.00' && $review['suggestion']['start_date'] === now('Asia/Riyadh')->toDateString(), 'code, exact amount and funding date prefill from the accepted message');
verifySms(! array_key_exists('profit', $review['suggestion']) && ! array_key_exists('allocations', $review['suggestion']), 'missing commercial terms and investors are never fabricated');
[$code] = smsRequest('GET', '/api/sms/messages/'.$acceptId.'/investment'); verifySms($code === 401, 'anonymous investment review is blocked');
[$code] = smsRequest('GET', '/api/sms/messages/'.$acceptId.'/investment', [], $other); verifySms($code === 404, 'another account cannot see the draft');
[$code] = smsRequest('GET', '/api/sms/messages/'.$acceptId.'/review', [], $owner); verifySms($code === 422, 'acceptance cannot enter the payment review form');
[$code] = approveReview($acceptId, ['kind' => 'deposit', 'amount' => '50001', 'entry_date' => $review['suggestion']['start_date'], 'reference' => '', 'version' => $review['version'], 'mode' => 'new', 'confirmed' => true]);
verifySms($code === 422 && walletSummary($owner)['summary']['balance_cents'] === $cashBeforeInvestment, 'acceptance cannot be forged into a wallet deposit');
$form = ['version' => $review['version'], 'code' => $review['suggestion']['code'], 'total_amount' => $review['suggestion']['total_amount'],
    'start_date' => $review['suggestion']['start_date'], 'withdrawal_date' => $review['suggestion']['start_date'], 'profit' => '510.01',
    'category' => 'B+', 'months' => 6, 'maturity_date' => '2027-04-26', 'notes' => 'synthetic acceptance check',
    'allocations' => [['investor_id' => 1, 'amount' => '30000.00'], ['investor_id' => 2, 'amount' => '20001.00']]];
[$code] = finishInvestment($acceptId, $form, $other); verifySms($code === 404, 'foreign-owner completion is blocked before any creation');
[$code] = finishInvestment($acceptId, array_replace($form, ['version' => str_repeat('0', 64)])); verifySms($code === 409, 'stale decision versions are blocked');
[$code] = finishInvestment($acceptId, array_replace($form, ['allocations' => []])); verifySms($code === 422 && opportunityCount() === $opportunitiesBefore, 'missing investor allocation rolls back the whole creation');
[$code] = finishInvestment($acceptId, array_replace($form, ['allocations' => [['investor_id' => 1, 'amount' => '50000.99']]]));
verifySms($code === 422 && opportunityCount() === $opportunitiesBefore, 'an incorrect participation total cannot create a partial investment record');
$allocationsBefore = DB::table('investment_opportunity_allocations')->count();
$auditBefore = DB::table('ta3meed_investor_audits')->count();
DB::statement("CREATE TRIGGER fail_acceptance_decision BEFORE UPDATE ON sms_archive_messages WHEN NEW.analysis_status = 'investment_created' BEGIN SELECT RAISE(ABORT, 'isolated acceptance rollback'); END");
[$code] = finishInvestment($acceptId, $form);
verifySms($code === 500 && opportunityCount() === $opportunitiesBefore && DB::table('investment_opportunity_allocations')->count() === $allocationsBefore
    && DB::table('ta3meed_investor_audits')->count() === $auditBefore, 'a failed final decision rolls back opportunity, investor allocations and audit together');
DB::statement('DROP TRIGGER fail_acceptance_decision');
[$code, $created] = finishInvestment($acceptId, $form);
verifySms($code === 200 && $created['analysis']['status'] === 'investment_created' && opportunityCount() === $opportunitiesBefore + 1, 'only explicit completed form submission creates the opportunity');
$createdId = $created['data']['id'];
$storedOpportunity = DB::table('investment_opportunities')->where('id', $createdId)->first();
verifySms((int) $storedOpportunity->user_id === 1 && (int) round($storedOpportunity->principal_amount * 100) === 5000100 && json_decode($storedOpportunity->metadata, true)['category'] === 'B+', 'created opportunity preserves owner, exact capital and manually entered classification');
verifySms(substr($storedOpportunity->start_date, 0, 10) === $form['start_date'] && json_decode($storedOpportunity->metadata, true)['withdrawal_date'] === $form['withdrawal_date'], 'funding date is stored in the normal opportunity fields');
verifySms((int) round(DB::table('investment_opportunity_allocations')->where('opportunity_id', $createdId)->sum('invested_amount') * 100) === 5000100, 'real investor allocations contain the entire exact capital');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cashBeforeInvestment && DB::table('ta3meed_receipts')->count() === $receiptsBefore, 'manual investment completion never fabricates a deposit, withdrawal or repayment');
[$code, $replayed] = finishInvestment($acceptId, $form);
verifySms($code === 200 && $replayed['replayed'] && $replayed['data']['id'] === $createdId && opportunityCount() === $opportunitiesBefore + 1, 'lost completed responses retry without another opportunity');
[$code] = finishInvestment($acceptId, array_replace($form, ['profit' => '510.02'])); verifySms($code === 409, 'a completed decision cannot be changed through a retry');
[$code] = cancelInvestment($acceptId, $review['version']); verifySms($code === 409 && opportunityCount() === $opportunitiesBefore + 1, 'cancel cannot delete an already completed opportunity');
[$duplicate] = receivePayment($body.' رسالة مستقلة');
$duplicateReview = investmentReview($duplicate['message_id']);
[$code] = finishInvestment($duplicate['message_id'], array_replace($form, ['version' => $duplicateReview['version'], 'code' => 'eraccept900']));
verifySms($code === 422 && opportunityCount() === $opportunitiesBefore + 1, 'case and hyphen variations cannot duplicate an existing opportunity');

[$cancelled, $cancelPayload] = receivePayment('تم قبول استثمارك بمبلغ 17.19 في الفرصة رقم ER-CANCEL901 وتستطيع الغاء الاستثمار خلال 48 ساعة');
$cancelId = $cancelled['message_id']; $cancelReview = investmentReview($cancelId);
[$code] = cancelInvestment($cancelId, $cancelReview['version'], $other); verifySms($code === 404, 'another account cannot discard a message');
[$code] = cancelInvestment($cancelId, str_repeat('0', 64)); verifySms($code === 409, 'stale cancellation cannot erase a changed message');
[$code, $dismissed] = cancelInvestment($cancelId, $cancelReview['version']);
verifySms($code === 200 && $dismissed['dismissed'] && opportunityCount() === $opportunitiesBefore + 1, 'cancel records no investment');
$tombstone = DB::table('sms_archive_messages')->where('id', $cancelId)->first();
verifySms(Crypt::decryptString($tombstone->body) === '' && Crypt::decryptString($tombstone->sender) === '' && $tombstone->payment_reference === null && $tombstone->payment_amount === null, 'cancellation erases sender, body, amount and reference instead of archiving them');
[$code] = cancelInvestment($cancelId, $cancelReview['version']); verifySms($code === 200, 'an uncertain cancellation response can be retried safely');
[$code] = finishInvestment($cancelId, array_replace($form, ['version' => $cancelReview['version'], 'code' => 'ER-CANCEL901'])); verifySms($code === 409, 'a cancelled message cannot later create an investment');
[$afterRetry] = receivePayment($cancelPayload['body'], $cancelPayload);
verifySms($afterRetry['status'] === 'dismissed' && $afterRetry['notification'] === null && Crypt::decryptString(DB::table('sms_archive_messages')->where('id', $cancelId)->value('body')) === '', 'a delayed device retry cannot restore cancelled text or its pending action');
[$code, $archive] = smsRequest('GET', '/api/sms/messages', [], $owner);
verifySms(! in_array($cancelId, array_column($archive['data'], 'id')) && in_array($cancelId, $archive['dismissed_ids']), 'cancelled content is hidden and other app caches can remove the message');

[$legacy] = receivePayment('تم قبول استثمارك بمبلغ 20.25 في الفرصة رقم ER-LEGACY902 بتاريخ 2026-10-25');
DB::table('sms_archive_messages')->where('id', $legacy['message_id'])->update(['analysis_status' => 'non_payment', 'analysis_reason' => 'not_a_payment', 'action_type' => 'repayment', 'payment_amount' => null, 'payment_reference' => null]);
[$code, $archive] = smsRequest('GET', '/api/sms/messages', [], $owner);
$legacyItem = collect($archive['data'])->firstWhere('id', $legacy['message_id']);
verifySms($legacyItem['analysis']['action_type'] === 'investment' && $legacyItem['analysis']['status'] === 'needs_review', 'the acceptance already shown in the screenshot becomes reviewable without financial backfill');
verifySms(DB::table('sms_archive_messages')->where('id', $legacy['message_id'])->value('analysis_status') === 'non_payment', 'merely viewing an old acceptance never rewrites archive or financial data');
$legacyReview = investmentReview($legacy['message_id']);
verifySms($legacyReview['suggestion']['start_date'] === '2026-10-25' && $legacyReview['suggestion']['date_source'] === 'message', 'explicit funding date takes precedence over SMS arrival');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cashBeforeInvestment, 'all acceptance decisions preserve wallet cash until an actual wallet transaction occurs');
$investmentSuiteComplete = true;
echo 'SMS_INVESTMENT_INTEGRATION_PASSED investment_checks='.($checks - $investmentBaseline).' total_checks='.$checks."\n";
