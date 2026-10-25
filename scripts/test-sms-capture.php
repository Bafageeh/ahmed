<?php

// Integration checks run in a separate process against an in-memory database only.
// Usage: php scripts/test-sms-capture.php PROJECT_ROOT [STAGED_SOURCE_ROOT]
$root = $argv[1] ?? dirname(__DIR__);
$source = $argv[2] ?? $root;
require $root.'/ahmed-api/vendor/autoload.php';
$app = require $root.'/ahmed-api/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config([
    'database.default' => 'sqlite',
    'database.connections.sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true],
    'cache.default' => 'array',
    'cache.stores.array' => ['driver' => 'array', 'serialize' => false],
    'app.key' => 'base64:'.base64_encode(random_bytes(32)),
    'app.debug' => false,
]);
Illuminate\Support\Facades\DB::purge();
Illuminate\Support\Facades\Crypt::clearResolvedInstance('encrypter');
$app->forgetInstance('encrypter');
if (config('database.connections.sqlite.database') !== ':memory:' || config('database.default') !== 'sqlite') {
    throw new RuntimeException('SMS checks require an isolated in-memory database');
}

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

Schema::create('users', function ($table) {
    $table->id(); $table->string('name'); $table->string('email')->unique(); $table->string('username')->unique();
    $table->string('password'); $table->string('remember_token', 100)->nullable(); $table->boolean('is_admin')->default(false); $table->timestamps();
});
(require $source.'/ahmed-api/database/migrations/2026_10_25_180000_create_sms_capture_tables.php')->up();
(require $source.'/ahmed-api/database/migrations/2026_10_26_003000_add_sms_payment_analysis.php')->up();
(require $source.'/ahmed-api/database/migrations/2026_10_26_020000_create_ta3meed_wallet.php')->up();
require_once $source.'/ahmed-api/app/Http/Controllers/Api/SmsCaptureController.php';
Route::prefix('api')->group($source.'/ahmed-api/routes/sms.php');

$tokens = [1 => str_repeat('a', 80), 2 => str_repeat('b', 80)];
foreach ($tokens as $id => $token) {
    DB::table('users')->insert(['id' => $id, 'name' => 'SMS test '.$id, 'username' => 'sms-test-'.$id, 'email' => 'sms-'.$id.'@example.invalid', 'password' => password_hash(Str::random(32), PASSWORD_BCRYPT), 'remember_token' => hash('sha256', $token), 'is_admin' => $id === 1]);
}
$checks = 0;
function verifySms($condition, string $description): void
{
    global $checks;
    if (! $condition) throw new RuntimeException('SMS integration check failed: '.$description);
    $checks++;
}
function smsRequest(string $method, string $path, array $body = [], array $headers = []): array
{
    global $app;
    $server = ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'];
    foreach ($headers as $name => $value) $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
    $request = Illuminate\Http\Request::create($path, $method, [], [], [], $server, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    $response = $kernel->handle($request);
    $result = [$response->getStatusCode(), json_decode($response->getContent(), true)];
    $kernel->terminate($request, $response);
    return $result;
}
$owner = ['Authorization' => 'Bearer '.$tokens[1], 'X-Ahmed-User-Id' => '2'];
$other = ['Authorization' => 'Bearer '.$tokens[2], 'X-Ahmed-User-Id' => '1'];
[$code] = smsRequest('GET', '/api/sms/messages'); verifySms($code === 401, 'anonymous archive access blocked');
$installation = (string) Str::uuid();
[$code, $registration] = smsRequest('POST', '/api/sms/devices', ['installation_id' => $installation], $owner);
verifySms($code === 200 && strlen($registration['upload_token'] ?? '') === 80, 'device registration');
verifySms((int) DB::table('sms_capture_devices')->value('user_id') === 1, 'client user-id header cannot change ownership');
$upload = ['X-Ahmed-SMS-Token' => $registration['upload_token']];
$message = ['client_id' => (string) Str::uuid(), 'sender' => 'Ta3meed', 'body' => "  سداد تجريبي\nسطر ثانٍ  ", 'received_at_ms' => $registration['data']['capture_from_ms'] + 1, 'sent_at_ms' => 1, 'sim_slot' => 0];
[$code, $saved] = smsRequest('POST', '/api/sms/ingest', ['messages' => [$message], 'user_id' => 2], $upload);
verifySms($code === 200 && ($saved['accepted_client_ids'][0] ?? '') === $message['client_id'], 'new message ingestion');
[$retryCode] = smsRequest('POST', '/api/sms/ingest', ['messages' => [$message]], $upload);
verifySms($retryCode === 200 && DB::table('sms_archive_messages')->count() === 1, 'network retry cannot duplicate a message');
$stored = DB::table('sms_archive_messages')->first();
verifySms($stored->sender !== $message['sender'] && $stored->body !== $message['body'], 'sender and text encrypted at rest');
[$code, $archive] = smsRequest('GET', '/api/sms/messages', [], $owner);
verifySms($code === 200 && $archive['data'][0]['sender'] === $message['sender'] && $archive['data'][0]['body'] === $message['body'], 'sender and complete SMS text round-trip unchanged');
verifySms($archive['data'][0]['sent_at_ms'] === 1, 'delayed new arrival is accepted regardless of original send date');
[$code, $empty] = smsRequest('GET', '/api/sms/messages', [], $other);
verifySms($code === 200 && $empty['total'] === 0, 'other user cannot read archived messages');
[$code] = smsRequest('GET', '/api/sms/messages', [], ['Authorization' => 'Bearer '.$registration['upload_token']]);
verifySms($code === 401, 'ingestion credential cannot read account data');
$old = $message; $old['client_id'] = (string) Str::uuid(); $old['received_at_ms'] = $registration['data']['capture_from_ms'] - 1;
[$code] = smsRequest('POST', '/api/sms/ingest', ['messages' => [$old]], $upload);
verifySms($code === 422 && DB::table('sms_archive_messages')->count() === 1, 'messages predating activation are rejected');
[$code] = smsRequest('DELETE', '/api/sms/devices/'.$installation, [], $other);
[$stillEnabled] = smsRequest('POST', '/api/sms/ingest', ['messages' => [$message]], $upload);
verifySms($stillEnabled === 200, 'another account cannot revoke this device');
smsRequest('DELETE', '/api/sms/devices/'.$installation, [], $owner);
[$code] = smsRequest('POST', '/api/sms/ingest', ['messages' => [$message]], $upload);
verifySms($code === 401, 'disabled device credential is revoked');
[$code, $again] = smsRequest('POST', '/api/sms/devices', ['installation_id' => $installation], $owner);
verifySms($code === 200 && $again['data']['capture_from_ms'] === $registration['data']['capture_from_ms'], 'reconnection preserves the cutoff for an existing offline queue');
$new = $message; $new['client_id'] = (string) Str::uuid(); $new['sender'] = '+966500000001';
[$code] = smsRequest('POST', '/api/sms/ingest', ['messages' => [$new]], ['X-Ahmed-SMS-Token' => $again['upload_token']]);
verifySms($code === 200 && DB::table('sms_archive_messages')->count() === 1, 'excluded sender is acknowledged without storage');

// Exercise the actual receipt ledger and investor allocation code, never a mocked payment writer.
foreach (['2026_05_04_000001_create_financial_core_tables.php', '2026_05_04_000002_create_investment_investors_and_allocations.php',
    '2026_05_12_160000_create_ta3meed_receipts_tables.php', '2026_05_06_000012_add_received_at_to_investment_opportunities_table.php'] as $migration) {
    (require $source.'/ahmed-api/database/migrations/'.$migration)->up();
}
foreach (['investment_opportunities', 'investment_investors', 'investment_opportunity_allocations', 'ta3meed_receipts', 'ta3meed_receipt_allocations'] as $table) {
    Schema::table($table, fn ($schema) => $schema->unsignedBigInteger('user_id'));
}
DB::table('investment_platforms')->insert(['id' => 1, 'code' => 'ta3meed', 'name_ar' => 'تعميد']);
foreach ([1, 2] as $id) {
    DB::table('investment_accounts')->insert(['id' => $id, 'user_id' => $id, 'platform_id' => 1, 'display_name' => 'test account '.$id]);
    DB::table('investment_investors')->insert(['id' => $id, 'user_id' => 1, 'code' => 'TEST-'.$id, 'name' => 'Test investor '.$id]);
}
function smsOpportunity(int $id, string $reference, int $ownerId = 1): void
{
    DB::table('investment_opportunities')->insert(['id' => $id, 'user_id' => $ownerId, 'account_id' => $ownerId, 'platform_id' => 1,
        'title' => 'Test opportunity', 'reference_number' => $reference, 'principal_amount' => 1000, 'expected_profit_amount' => 100,
        'start_date' => '2026-01-01', 'maturity_date' => '2026-12-31', 'status' => 'active', 'metadata' => '{}']);
    foreach ([1 => 600, 2 => 400] as $investorId => $amount) {
        DB::table('investment_opportunity_allocations')->insert(['user_id' => $ownerId, 'opportunity_id' => $id,
            'investor_id' => $investorId, 'invested_amount' => $amount, 'expected_profit_amount' => $amount / 10]);
    }
}
function receivePayment(string $body, array $overrides = [], ?array $headers = null): array
{
    global $again;
    $payload = array_replace(['client_id' => (string) Str::uuid(), 'sender' => 'Ta3meed', 'body' => $body,
        'received_at_ms' => (int) floor(microtime(true) * 1000), 'sent_at_ms' => null], $overrides);
    [$code, $json] = smsRequest('POST', '/api/sms/ingest', ['messages' => [$payload]], $headers ?? ['X-Ahmed-SMS-Token' => $again['upload_token']]);
    verifySms($code === 200, 'payment ingestion succeeds');
    return [$json['outcomes'][0] ?? null, $payload, $json];
}
smsOpportunity(10, 'INV-TEST10');
smsOpportunity(11, 'INV-TEST11');
smsOpportunity(12, 'INV-OTHER12', 2);
smsOpportunity(13, 'INV-TEST13');
smsOpportunity(14, 'INV-TEST14');
[$partial, $partialPayload] = receivePayment('تم سداد جزئي للفرصة INV-TEST10 بقيمة ١٠٠٫٧٥ ريال');
verifySms($partial['status'] === 'applied' && $partial['receipt_id'] && $partial['notification']['title'] === 'تم تسجيل سداد تعميد', 'partial Arabic-decimal payment recorded before success notification');
verifySms(DB::table('ta3meed_receipts')->count() === 1 && DB::table('investment_opportunities')->where('id', 10)->value('status') === 'partial_received', 'partial payment updates the opportunity');
verifySms(DB::table('ta3meed_receipt_allocations')->where('investor_id', 1)->value('received_amount') == 60.45
    && DB::table('ta3meed_receipt_allocations')->where('investor_id', 2)->value('received_amount') == 40.30, 'payment divided across real investor shares with exact cent remainder');
[$retry] = receivePayment($partialPayload['body'], $partialPayload);
verifySms($retry['receipt_id'] === $partial['receipt_id'] && DB::table('ta3meed_receipts')->count() === 1, 'lost response and retry returns the same committed outcome');
[$repeat] = receivePayment($partialPayload['body'], ['sender' => ' ta3meed ']);
verifySms($repeat['status'] === 'duplicate' && $repeat['notification'] === null && DB::table('ta3meed_receipts')->count() === 1, 'a new UUID and sender capitalization cannot repeat a payment');
[$code, $secondDevice] = smsRequest('POST', '/api/sms/devices', ['installation_id' => (string) Str::uuid()], $owner);
[$repeat] = receivePayment($partialPayload['body'], [], ['X-Ahmed-SMS-Token' => $secondDevice['upload_token']]);
verifySms($repeat['status'] === 'duplicate' && DB::table('ta3meed_receipts')->count() === 1, 'duplicates are prevented across devices of the same account');
[$review] = receivePayment('تم سداد جزئي للفرصة INV-TEST10 بمبلغ 100.75 ريال بنجاح');
verifySms($review['status'] === 'needs_review' && $review['reason'] === 'possible_duplicate_receipt', 'a possible manual duplicate is held for review');
[$full] = receivePayment('تم سداد كلي للفرصة INV-TEST10 بقيمة 999.25 ريال');
verifySms($full['status'] === 'applied' && DB::table('investment_opportunities')->where('id', 10)->value('status') === 'received', 'final payment completes the opportunity');
verifySms(DB::table('investment_opportunities')->where('id', 10)->value('actual_profit_amount') == 100
    && DB::table('investment_opportunity_allocations')->where('opportunity_id', 10)->where('investor_id', 1)->value('actual_profit_amount') == 60, 'final profit and investor balances are recalculated');
verifySms(DB::table('investment_opportunities')->where('id', 10)->value('start_date') === '2026-01-01', 'payment processing preserves investment funding dates');
[$early] = receivePayment('تم سداد مبكر للفرصة INV-TEST11 بقيمة 1,050.00 ريال');
verifySms($early['status'] === 'applied' && DB::table('investment_opportunities')->where('id', 11)->value('actual_profit_amount') == 50, 'early settlement uses actual received profit');
[$installment] = receivePayment('تم إيداع دفعة من رأس المال والأرباح للفرصة INV-TEST14 بقيمة 100 ريال');
verifySms($installment['status'] === 'applied' && DB::table('investment_opportunities')->where('id', 14)->value('status') === 'partial_received', 'a capital-and-profit installment cannot close an opportunity prematurely');
$receiptCount = DB::table('ta3meed_receipts')->count();
foreach ([
    ['تم سداد الفرصة INV-OTHER12 بقيمة 100 ريال', 'opportunity_not_found'],
    ['تم سداد الفرصة INV-TEST13 بقيمة 2000 ريال', 'amount_exceeds_remaining'],
    ['تم سداد كلي للفرصة INV-TEST13 بقيمة 20 ريال', 'final_amount_below_remaining_principal'],
    ['تم سداد الفرصة INV-TEST13 بقيمة 20.123 ريال', 'missing_or_ambiguous_amount'],
    ['تم سداد الفرصة INV-TEST13 بقيمة 1,50 ريال', 'missing_or_ambiguous_amount'],
    ['تم سداد الفرصة INV-TEST13 بقيمة 100 ريال ومبلغ 200 ريال', 'missing_or_ambiguous_amount'],
    ['تم سداد الفرصتين INV-TEST13 و INV-TEST14 بقيمة 100 ريال', 'missing_or_ambiguous_reference'],
    ['تم سداد الفرصة INV-TEST13 بقيمة 100 ريال بتاريخ 2099-01-01', 'invalid_payment_date'],
    ['تم سداد الفرصة INV-TEST13 بقيمة 100 ريال بتاريخ 2026-02-30', 'invalid_payment_date'],
] as [$body, $reason]) {
    [$review] = receivePayment($body);
    verifySms($review['status'] === 'needs_review' && $review['reason'] === $reason && $review['notification']['title'] !== 'تم تسجيل سداد تعميد', 'ambiguous or unsafe payment held: '.$reason);
}
foreach (['سيتم سداد الفرصة INV-TEST13 بقيمة 100 ريال', 'لم يتم سداد الفرصة INV-TEST13 بقيمة 100 ريال', 'رمز التحقق 1234', 'فرصة استثمار جديدة بقيمة 100 ريال INV-TEST13'] as $body) {
    [$nonPayment] = receivePayment($body);
    verifySms($nonPayment['status'] === 'non_payment' && $nonPayment['notification'] === null, 'reminders, verification and marketing never change receipts');
}
verifySms(DB::table('ta3meed_receipts')->count() === $receiptCount, 'review-only and other-account messages never write payments');
$archived = DB::table('sms_archive_messages')->count();
foreach (['Ta3meed-Ads', 'Other-Ta3meed', 'BANK', '+966500000000'] as $sender) receivePayment('تم سداد الفرصة INV-TEST13 بقيمة 100 ريال', ['sender' => $sender]);
verifySms(DB::table('sms_archive_messages')->count() === $archived, 'sender matches the whole ID rather than a substring');
DB::statement("CREATE TRIGGER fail_sms_allocation BEFORE INSERT ON ta3meed_receipt_allocations BEGIN SELECT RAISE(ABORT, 'intentional isolated rollback test'); END");
[$failure] = receivePayment('تم سداد الفرصة INV-TEST13 بقيمة 123 ريال');
verifySms($failure['status'] === 'needs_review' && $failure['reason'] === 'processing_failed'
    && DB::table('ta3meed_receipts')->count() === $receiptCount
    && DB::table('investment_opportunities')->where('id', 13)->value('status') === 'active', 'an allocation failure rolls back its receipt and never reports completion');
DB::statement('DROP TRIGGER fail_sms_allocation');
[$code, $after] = smsRequest('GET', '/api/sms/messages', [], $owner);
verifySms($code === 200 && isset($after['data'][0]['analysis']['status']), 'the app archive exposes the committed analysis result');
echo 'SMS_CAPTURE_INTEGRATION_PASSED checks='.$checks."\n";
