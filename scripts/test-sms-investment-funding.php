<?php

$fundingSuiteComplete = false;
register_shutdown_function(static function () use (&$fundingSuiteComplete): void {
    if (! $fundingSuiteComplete) { fwrite(STDERR, "Investment funding suite did not finish\n"); exit(1); }
});
require __DIR__.'/test-sms-investment.php';

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Database\QueryException;

$fundingBaseline = $checks;
$beforeMigration = walletSummary($owner)['summary'];
(require $source.'/ahmed-api/database/migrations/2026_10_26_170000_link_wallet_investment_funding.php')->up();
verifySms(walletSummary($owner)['summary'] === $beforeMigration, 'adding funding links never backfills historical wallet deductions');

function uploadedInvestment(int $id, string $version, ?array $headers = null, array $extra = []): array {
    global $owner;
    return smsRequest('POST', '/api/sms/messages/'.$id.'/investment/uploaded', ['version' => $version] + $extra, $headers ?? $owner);
}
function fundingOpportunity(int $id, string $ref, string $amount, int $user = 1, int $platform = 1): void {
    $cents = App\Support\Ta3meedAllocationPolicy::cents($amount);
    DB::table('investment_opportunities')->insert(['id' => $id, 'user_id' => $user, 'account_id' => $user, 'platform_id' => $platform,
        'title' => 'Synthetic pre-entered opportunity', 'reference_number' => $ref, 'principal_amount' => $amount, 'expected_profit_amount' => 0,
        'start_date' => now('Asia/Riyadh')->toDateString(), 'maturity_date' => '2027-04-26', 'status' => 'active', 'metadata' => '{}']);
    DB::table('investment_opportunity_allocations')->insert(['user_id' => $user, 'opportunity_id' => $id,
        'investor_id' => 1, 'invested_amount' => $cents / 100, 'expected_profit_amount' => 0]);
}
function fundingMessage(string $ref, string $amount, string $suffix = ''): array {
    [$message] = receivePayment('تم قبول استثمارك بمبلغ '.$amount.' في الفرصة رقم '.$ref.' وتستطيع الغاء الاستثمار خلال 48 ساعة '.$suffix);
    return [$message['message_id'], investmentReview($message['message_id'])];
}
function fundingUnchanged(): array {
    $result = [];
    foreach (['investment_opportunities', 'investment_opportunity_allocations', 'ta3meed_receipts', 'ta3meed_receipt_allocations', 'ta3meed_investor_audits'] as $table) {
        $result[$table] = hash('sha256', json_encode(DB::table($table)->orderBy('id')->get()));
    }
    return $result;
}

fundingOpportunity(9001, 'ER-FUND001', '1234.56');
[$fundId, $fundReview] = fundingMessage('ER-FUND001', '1234.56');
$fundOriginal = DB::table('sms_archive_messages')->where('id', $fundId)->first();
$cash = walletSummary($owner)['summary']['balance_cents'];
$entries = DB::table('ta3meed_wallet_entries')->count();
$audits = DB::table('ta3meed_wallet_audits')->count();
$financialBefore = fundingUnchanged();
[$code] = smsRequest('POST', '/api/sms/messages/'.$fundId.'/investment/uploaded', ['version' => $fundReview['version']]);
verifySms($code === 401, 'anonymous users cannot deduct investment cash');
[$code] = uploadedInvestment($fundId, $fundReview['version'], $other); verifySms($code === 404, 'another account cannot fund the owner opportunity');
[$code] = uploadedInvestment($fundId, 'invalid'); verifySms($code === 422, 'funding requires a valid review version');
[$code] = uploadedInvestment($fundId, str_repeat('0', 64)); verifySms($code === 409, 'a stale decision cannot deduct cash');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'viewing, receiving and rejected funding requests never debit the wallet');
[$code, $funded] = uploadedInvestment($fundId, $fundReview['version'], null, ['amount' => '1', 'opportunity_id' => 9002, 'entry_date' => '2099-01-01']);
verifySms($code === 200 && $funded['analysis']['status'] === 'investment_funded' && ! $funded['replayed'], 'only the explicit uploaded button funds the existing opportunity');
$entryId = $funded['analysis']['wallet_entry_id'];
$entry = DB::table('ta3meed_wallet_entries')->where('id', $entryId)->first();
verifySms((int) $entry->amount_cents === -123456 && $entry->kind === 'withdrawal' && $entry->source === 'sms' && (int) $entry->investment_opportunity_id === 9001, 'server extracts exact capital and target without trusting client amounts or identifiers');
verifySms((int) $entry->sms_message_id === $fundId && substr($entry->entry_date, 0, 10) === now('Asia/Riyadh')->toDateString(), 'one immutable debit links original SMS, funding date and opportunity');
verifySms($funded['summary']['balance_cents'] === $cash - 123456 && DB::table('ta3meed_wallet_entries')->count() === $entries + 1 && DB::table('ta3meed_wallet_audits')->count() === $audits + 1, 'one exact debit and one audit commit together');
$stored = DB::table('sms_archive_messages')->where('id', $fundId)->first();
verifySms($stored->sender === $fundOriginal->sender && $stored->body === $fundOriginal->body && $stored->received_at_ms === $fundOriginal->received_at_ms, 'funding preserves the original encrypted sender, message and timestamp');
verifySms(fundingUnchanged() === $financialBefore, 'uploaded never creates or changes opportunities, allocations, repayments or investor records');
[$code, $retry] = uploadedInvestment($fundId, $fundReview['version']);
verifySms($code === 200 && $retry['replayed'] && $retry['analysis']['wallet_entry_id'] === $entryId && $retry['summary'] === $funded['summary'], 'a lost response or double tap cannot repeat the debit');
[$code] = cancelInvestment($fundId, $fundReview['version']); verifySms($code === 409, 'cancellation cannot erase or refund an already funded SMS');
[$code, $archiveData] = smsRequest('GET', '/api/sms/messages', [], $owner);
$fundedArchive = collect($archiveData['data'])->firstWhere('id', $fundId);
verifySms($fundedArchive['analysis']['status'] === 'investment_funded' && $fundedArchive['analysis']['wallet_entry_id'] === $entryId && $fundedArchive['analysis']['notification'] === null, 'archive stays funded without generating repeated native notifications');
$walletRow = collect(walletSummary($owner)['data'])->firstWhere('id', $entryId);
verifySms($walletRow['investment_opportunity_id'] === 9001 && ! $walletRow['editable'] && $walletRow['amount_cents'] === -123456, 'wallet displays a non-editable opportunity funding debit');

[$againId, $againReview] = fundingMessage('er-fund001', '1234.56', 'بتاريخ 2026-10-25');
[$code, $againResult] = uploadedInvestment($againId, $againReview['version']);
verifySms($code === 200 && $againResult['replayed'] && $againResult['analysis']['wallet_entry_id'] === $entryId && $againResult['analysis']['reason'] === 'investment_previously_funded', 'a different SMS ID and date for the same opportunity link to the existing debit');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash - 123456 && DB::table('ta3meed_wallet_entries')->count() === $entries + 1, 'duplicate acceptance wording never deducts capital twice');
fundingOpportunity(9002, 'ER-FUND002', '1234.56');
[$distinctId, $distinctReview] = fundingMessage('ER-FUND002', '1234.56');
[$code, $distinctFund] = uploadedInvestment($distinctId, $distinctReview['version']);
verifySms($code === 200 && ! $distinctFund['replayed'] && $distinctFund['analysis']['wallet_entry_id'] !== $entryId, 'two genuinely different opportunities can have equal capital on the same day');
$cash = walletSummary($owner)['summary']['balance_cents'];

[$missingId, $missingReview] = fundingMessage('ER-MISSING999', '91.01');
[$code] = uploadedInvestment($missingId, $missingReview['version']); verifySms($code === 409 && str_contains(DB::table('sms_archive_messages')->where('id', $missingId)->value('analysis_status'), 'needs_review'), 'a missing opportunity stays pending without creating an investment');
fundingOpportunity(9003, 'ER-OTHER003', '91.03', 2);
[$foreignId, $foreignReview] = fundingMessage('ER-OTHER003', '91.03');
[$code] = uploadedInvestment($foreignId, $foreignReview['version']); verifySms($code === 409, 'an opportunity in another owner account cannot be used');
DB::table('investment_platforms')->insert(['id' => 90, 'code' => 'other-test-platform', 'name_ar' => 'Synthetic other platform']);
fundingOpportunity(9004, 'ER-PLATFORM004', '91.04', 1, 90);
[$platformId, $platformReview] = fundingMessage('ER-PLATFORM004', '91.04');
[$code] = uploadedInvestment($platformId, $platformReview['version']); verifySms($code === 409, 'a matching code on another platform is not a Ta3meed opportunity');
fundingOpportunity(9005, 'ER-MISMATCH005', '91.05');
[$mismatchId, $mismatchReview] = fundingMessage('ER-MISMATCH005', '91.06');
[$code] = uploadedInvestment($mismatchId, $mismatchReview['version']); verifySms($code === 409, 'message and opportunity capital must agree exactly');
fundingOpportunity(9006, 'ER-AMBIG006', '91.06'); fundingOpportunity(9007, 'erambig006', '91.06');
[$ambiguousId, $ambiguousReview] = fundingMessage('ER-AMBIG006', '91.06');
[$code] = uploadedInvestment($ambiguousId, $ambiguousReview['version']); verifySms($code === 409, 'multiple normalized reference matches block funding');
fundingOpportunity(9008, 'ER-CANCELLED008', '91.08');
DB::table('investment_opportunities')->where('id', 9008)->update(['status' => 'cancelled']);
[$closedId, $closedReview] = fundingMessage('ER-CANCELLED008', '91.08');
[$code] = uploadedInvestment($closedId, $closedReview['version']); verifySms($code === 409, 'cancelled opportunities cannot consume wallet cash');
[$noAmount] = receivePayment('تم قبول استثمارك في الفرصة رقم ER-NOAMOUNT009'); $noAmountReview = investmentReview($noAmount['message_id']);
[$code] = uploadedInvestment($noAmount['message_id'], $noAmountReview['version']); verifySms($code === 422, 'missing message capital cannot be guessed');
fundingOpportunity(9009, 'ER-DATE009', '91.09');
[$dateId, $dateReview] = fundingMessage('ER-DATE009', '91.09', 'بتاريخ 2099-01-01');
[$code] = uploadedInvestment($dateId, $dateReview['version']); verifySms($code === 422, 'future or unclear funding dates cannot create cash deductions');
verifySms(walletSummary($owner)['summary']['balance_cents'] === $cash, 'all rejected uploads preserve cash');

fundingOpportunity(9010, 'ER-MANUAL010', '91.10');
[$code] = walletManual('withdrawal', '91.10'); verifySms($code === 200, 'existing manual withdrawal fixture');
$cash = walletSummary($owner)['summary']['balance_cents'];
[$manualId, $manualReview] = fundingMessage('ER-MANUAL010', '91.10');
[$code] = uploadedInvestment($manualId, $manualReview['version']); verifySms($code === 409 && walletSummary($owner)['summary']['balance_cents'] === $cash, 'possible prior manual deductions require review and are not repeated');
fundingOpportunity(9011, 'ER-MANUAL011', '91.11');
[$code] = walletManual('withdrawal', '91.11', ['entry_date' => '2026-10-25', 'transaction_reference' => 'er-manual011']);
verifySms($code === 200, 'prior explicit investment reference fixture');
$cash = walletSummary($owner)['summary']['balance_cents'];
[$oldManualId, $oldManualReview] = fundingMessage('ER-MANUAL011', '91.11');
[$code] = uploadedInvestment($oldManualId, $oldManualReview['version']); verifySms($code === 409 && walletSummary($owner)['summary']['balance_cents'] === $cash, 'an existing deduction with the same reference blocks a second debit even on another date');

fundingOpportunity(9012, 'ER-ROLLBACK012', '91.12');
[$rollbackId, $rollbackReview] = fundingMessage('ER-ROLLBACK012', '91.12');
$entryCount = DB::table('ta3meed_wallet_entries')->count(); $auditCount = DB::table('ta3meed_wallet_audits')->count();
DB::statement("CREATE TRIGGER fail_funding_decision BEFORE UPDATE ON sms_archive_messages WHEN NEW.analysis_status = 'investment_funded' BEGIN SELECT RAISE(ABORT, 'isolated funding rollback'); END");
[$code] = uploadedInvestment($rollbackId, $rollbackReview['version']);
verifySms($code === 500 && DB::table('ta3meed_wallet_entries')->count() === $entryCount && DB::table('ta3meed_wallet_audits')->count() === $auditCount
    && walletSummary($owner)['summary']['balance_cents'] === $cash, 'a failed message decision rolls back debit and audit atomically');
DB::statement('DROP TRIGGER fail_funding_decision');
DB::statement("CREATE TRIGGER fail_funding_audit BEFORE INSERT ON ta3meed_wallet_audits BEGIN SELECT RAISE(ABORT, 'isolated funding audit rollback'); END");
[$code] = uploadedInvestment($rollbackId, $rollbackReview['version']);
verifySms($code === 500 && DB::table('ta3meed_wallet_entries')->count() === $entryCount && DB::table('sms_archive_messages')->where('id', $rollbackId)->value('analysis_status') === 'needs_review', 'an audit failure cannot leave an untracked debit or a completed message');
DB::statement('DROP TRIGGER fail_funding_audit');
[$code] = uploadedInvestment($rollbackId, $rollbackReview['version']); verifySms($code === 200, 'rolled-back requests can retry the same version successfully');

$createdReview = investmentReview($acceptId);
$cash = walletSummary($owner)['summary']['balance_cents']; $opportunities = opportunityCount();
[$code, $completedFunding] = uploadedInvestment($acceptId, $createdReview['version']);
verifySms($code === 200 && $completedFunding['summary']['balance_cents'] === $cash - 5000100, 'an opportunity created through complete can subsequently be funded with uploaded');
[$code, $creationReplay] = finishInvestment($acceptId, $form);
verifySms($code === 200 && $creationReplay['replayed'] && opportunityCount() === $opportunities && $creationReplay['data']['id'] === $createdId, 'a late creation response retry after funding does not create or debit again');
[$ingestReplay] = receivePayment($acceptedPayload['body'], $acceptedPayload);
verifySms($ingestReplay['status'] === 'investment_funded' && $ingestReplay['notification'] === null && walletSummary($owner)['summary'] === $completedFunding['summary'], 'delayed native delivery retries keep the funded decision without another debit or notification');
[$code] = uploadedInvestment($cancelId, str_repeat('a', 64)); verifySms($code === 409, 'discarded acceptance messages remain discarded');

$fundingSuiteComplete = true;
echo 'SMS_INVESTMENT_FUNDING_INTEGRATION_PASSED funding_checks='.($checks - $fundingBaseline).' total_checks='.$checks."\n";
