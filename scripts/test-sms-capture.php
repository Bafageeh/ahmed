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
$message = ['client_id' => (string) Str::uuid(), 'sender' => 'Bank-اختبار', 'body' => "  سداد تجريبي\nسطر ثانٍ  ", 'received_at_ms' => $registration['data']['capture_from_ms'] + 1, 'sent_at_ms' => 1, 'sim_slot' => 0];
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
verifySms($code === 200 && DB::table('sms_archive_messages')->count() === 2, 'rotated device credential can synchronize pending messages');
echo 'SMS_CAPTURE_INTEGRATION_PASSED checks='.$checks."\n";
