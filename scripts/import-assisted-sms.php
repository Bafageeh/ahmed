<?php
// One explicitly requested historical SMS, not a phone inbox scan or a public endpoint.
// Rehearse against a private SQLite backup, then reuse the existing atomic processor.
ini_set('display_errors', '0');
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use App\Support\Ta3meedSmsParser;
use App\Support\Ta3meedSmsProcessor;
use App\Support\Ta3meedWalletLedger;
use App\Support\Ta3meedWalletSmsParser;

function requireAssisted($condition, string $message): void {
    if (! $condition) throw new RuntimeException($message);
}
function assistedProtectedReport(array $report, string $case, string $name): void {
    $json = json_encode($report, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    file_put_contents($case.'/'.$name.'.json', $json, LOCK_EX); chmod($case.'/'.$name.'.json', 0600);
    $key = random_bytes(32); $iv = random_bytes(12);
    $cipher = openssl_encrypt(gzencode($json, 9), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    requireAssisted(openssl_public_encrypt($key, $wrapped, file_get_contents($case.'/report-public.pem'), OPENSSL_PKCS1_OAEP_PADDING), 'Report protection failed');
    $encoded = strtoupper(bin2hex(json_encode(['key' => base64_encode($wrapped), 'iv' => base64_encode($iv), 'tag' => base64_encode($tag), 'ciphertext' => base64_encode($cipher)])));
    foreach (str_split($encoded, 4000) as $i => $part) echo 'ASSISTED_SMS_'.strtoupper($name).'_PART_'.$i.'='.$part."\n";
}
function assistedDigest(string $table, int $owner, array $excludedIds = []): string {
    $query = DB::table($table)->where('user_id', $owner)->orderBy('id');
    if ($excludedIds) $query->whereNotIn('id', $excludedIds);
    return hash('sha256', json_encode($query->get(), JSON_THROW_ON_ERROR));
}
function assistedBackup(string $target): void {
    requireAssisted(DB::connection()->getDriverName() === 'sqlite' && class_exists('SQLite3'), 'A safe SQLite backup is required');
    requireAssisted(! file_exists($target), 'Do not overwrite an existing recovery copy');
    $source = new SQLite3(DB::connection()->getDatabaseName(), SQLITE3_OPEN_READONLY);
    $destination = new SQLite3($target);
    requireAssisted($source->backup($destination), 'Online backup failed');
    requireAssisted($destination->querySingle('PRAGMA quick_check') === 'ok', 'Recovery copy did not pass integrity verification');
    $destination->close(); $source->close(); chmod($target, 0600);
}
function assistedImport(array $request): array {
    return DB::transaction(function () use ($request) {
        $owner = (int) $request['owner_id'];
        $account = DB::table('users')->where('id', $owner)->where('username', $request['owner_username'])->lockForUpdate()->first();
        requireAssisted($account !== null, 'Account identity changed');
        $existing = DB::table('sms_archive_messages')->where('user_id', $owner)->where('client_id', $request['request_id'])->first();
        if ($existing) {
            requireAssisted(Crypt::decryptString($existing->sender) === $request['sender'] && Crypt::decryptString($existing->body) === $request['body']
                && (int) $existing->received_at_ms === $request['received_at_ms'], 'An import identifier was reused with different content');
            return ['replayed' => true, 'message_id' => $existing->id, 'analysis' => Ta3meedSmsProcessor::outcome($existing), 'summary' => Ta3meedWalletLedger::summary($owner)];
        }
        foreach (DB::table('sms_archive_messages')->where('user_id', $owner)->where('analysis_status', '!=', 'dismissed')->get(['sender', 'body']) as $previous) {
            requireAssisted(! (Ta3meedSmsParser::allowedSender(Crypt::decryptString($previous->sender))
                && Ta3meedSmsParser::normalize(Crypt::decryptString($previous->body)) === Ta3meedSmsParser::normalize($request['body'])), 'This SMS already exists; review the original instead');
        }
        $unchanged = [];
        foreach (['investment_opportunities', 'investment_opportunity_allocations', 'investment_investors', 'ta3meed_receipts',
            'ta3meed_receipt_allocations', 'ta3meed_investor_audits', 'sms_archive_messages', 'sms_capture_devices', 'ta3meed_wallet_entries', 'ta3meed_wallet_audits'] as $table) {
            $unchanged[$table] = assistedDigest($table, $owner);
        }
        $before = Ta3meedWalletLedger::summary($owner);
        $device = $request['device_id'];
        DB::table('sms_capture_devices')->insert(['id' => $device, 'user_id' => $owner, 'installation_id' => $request['installation_id'],
            'label' => 'إضافة رسالة بطلب صاحب الحساب', 'enabled' => false, 'token_hash' => null,
            'capture_from_ms' => $request['received_at_ms'], 'created_at' => now(), 'updated_at' => now()]);
        $id = DB::table('sms_archive_messages')->insertGetId(['user_id' => $owner, 'device_id' => $device, 'client_id' => $request['request_id'],
            'sender' => Crypt::encryptString($request['sender']), 'sender_hash' => hash_hmac('sha256', $request['sender'], (string) config('app.key')),
            'body' => Crypt::encryptString($request['body']), 'received_at_ms' => $request['received_at_ms'], 'sent_at_ms' => null,
            'subscription_id' => null, 'sim_slot' => null, 'analysis_status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        app(Ta3meedSmsProcessor::class)->process(DB::table('sms_archive_messages')->where('id', $id)->first(), $request['body']);
        $message = DB::table('sms_archive_messages')->where('id', $id)->first();
        requireAssisted($message->analysis_status === 'applied' && $message->action_type === 'deposit' && $message->receipt_id === null, 'Deposit did not apply cleanly; transaction rolled back');
        $entry = DB::table('ta3meed_wallet_entries')->where('user_id', $owner)->where('id', $message->wallet_entry_id)->first();
        requireAssisted($entry && $entry->kind === 'deposit' && $entry->source === 'sms' && (int) $entry->amount_cents === $request['expected_cents']
            && substr($entry->entry_date, 0, 10) === $request['entry_date'] && (int) $entry->sms_message_id === (int) $id, 'Linked deposit is inconsistent');
        $auditIds = DB::table('ta3meed_wallet_audits')->where('user_id', $owner)->where('entry_id', $entry->id)->pluck('id')->all();
        requireAssisted(count($auditIds) === 1, 'One ledger audit is required');
        $exclude = ['sms_archive_messages' => [$id], 'sms_capture_devices' => [$device], 'ta3meed_wallet_entries' => [$entry->id], 'ta3meed_wallet_audits' => $auditIds];
        foreach ($unchanged as $table => $digest) requireAssisted(hash_equals($digest, assistedDigest($table, $owner, $exclude[$table] ?? [])), 'Existing account data changed unexpectedly: '.$table);
        $after = Ta3meedWalletLedger::summary($owner);
        requireAssisted($after['balance_cents'] - $before['balance_cents'] === $request['expected_cents']
            && $after['deposits_cents'] - $before['deposits_cents'] === $request['expected_cents']
            && $after['count'] === $before['count'] + 1, 'Wallet delta is inconsistent');
        foreach (['opening_cents', 'withdrawals_cents', 'repayments_cents', 'has_opening_balance'] as $key) requireAssisted($before[$key] === $after[$key], 'Unrelated wallet totals changed');
        $archiveRequest = Illuminate\Http\Request::create('/api/sms/messages', 'GET');
        $archiveRequest->attributes->set('ahmed_user_id', $owner);
        $archive = app(App\Http\Controllers\Api\SmsCaptureController::class)->index($archiveRequest)->getData(true);
        $visible = collect($archive['data'])->firstWhere('id', $id);
        requireAssisted($visible && $visible['sender'] === $request['sender'] && $visible['body'] === $request['body']
            && $visible['analysis']['status'] === 'applied', 'The app archive must show the complete committed SMS');
        return ['replayed' => false, 'message_id' => $id, 'analysis' => Ta3meedSmsProcessor::outcome($message),
            'before' => $before, 'summary' => $after, 'received_at_ms' => (int) $message->received_at_ms, 'original_text_verified' => true,
            'unrelated_records_unchanged' => true, 'existing_device_settings_unchanged' => true];
    });
}

$root = getenv('AHMED_SMS_ROOT'); $case = getenv('AHMED_SMS_CASE'); $mode = $argv[1] ?? '';
$report = ['ok' => false];
try {
    requireAssisted(in_array($mode, ['rehearse', 'live'], true), 'Unknown import mode');
    require $root.'/ahmed-api/vendor/autoload.php';
    $app = require $root.'/ahmed-api/bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $envelope = json_decode(file_get_contents($case.'/request-envelope.json'), true, 512, JSON_THROW_ON_ERROR);
    requireAssisted(openssl_private_decrypt(base64_decode($envelope['key']), $secret, file_get_contents($case.'/request-key.pem'), OPENSSL_PKCS1_OAEP_PADDING), 'Cannot open the authorized request');
    $plain = openssl_decrypt(base64_decode($envelope['ciphertext']), 'aes-256-gcm', $secret, OPENSSL_RAW_DATA, base64_decode($envelope['iv']), base64_decode($envelope['tag']));
    requireAssisted($plain !== false, 'Request integrity failed');
    $request = json_decode($plain, true, 512, JSON_THROW_ON_ERROR);
    foreach ($request['source_hashes'] as $path => $hash) requireAssisted(hash_equals($hash, hash_file('sha256', $root.'/ahmed-api/'.$path)), 'Live SMS processing source changed');
    requireAssisted(Ta3meedSmsParser::allowedSender($request['sender']), 'Unsupported sender');
    foreach (['request_id', 'device_id', 'installation_id'] as $key) requireAssisted(Illuminate\Support\Str::isUuid($request[$key]), 'Invalid stable import identity');
    $parsed = Ta3meedWalletSmsParser::parse($request['body']);
    requireAssisted($parsed['status'] === 'ready' && $parsed['kind'] === 'deposit' && $parsed['amount_cents'] === $request['expected_cents'], 'Original SMS does not match the authorized deposit');
    requireAssisted(Carbon\CarbonImmutable::createFromTimestampMs($request['received_at_ms'], 'Asia/Riyadh')->toDateString() === $request['entry_date']
        && $request['received_at_ms'] <= (int) floor(microtime(true) * 1000) && $request['received_at_ms'] >= 946684800000, 'Original date is invalid');
    DB::connection()->getPdo()->setAttribute(PDO::ATTR_TIMEOUT, 30);
    if ($mode === 'rehearse') {
        $sandbox = $case.'/rehearsal-'.getenv('AHMED_SMS_SHA').'.sqlite';
        if (! file_exists($sandbox)) assistedBackup($sandbox);
        $connectionName = config('database.default');
        config(['database.connections.'.$connectionName.'.database' => $sandbox]); DB::purge($connectionName);
        requireAssisted(DB::connection()->getDatabaseName() === $sandbox, 'Rehearsal database isolation failed');
        $first = assistedImport($request); $second = assistedImport($request);
        requireAssisted($second['replayed'] && $first['message_id'] === $second['message_id'] && $first['summary'] === $second['summary'], 'Import retry must not duplicate the deposit');
        $report = ['ok' => true, 'mode' => $mode, 'request_sha256' => hash('sha256', $plain), 'script_sha256' => hash_file('sha256', __FILE__),
            'result' => $first, 'retry_verified' => true];
    } else {
        $proof = json_decode(file_get_contents($case.'/rehearse.json'), true, 512, JSON_THROW_ON_ERROR);
        requireAssisted($proof['ok'] && $proof['retry_verified'] && hash_equals($proof['request_sha256'], hash('sha256', $plain))
            && hash_equals($proof['script_sha256'], hash_file('sha256', __FILE__)), 'The exact request and importer must pass rehearsal first');
        $backup = $case.'/live-before-'.getenv('AHMED_SMS_SHA').'.sqlite';
        if (! file_exists($backup)) assistedBackup($backup);
        $result = assistedImport($request);
        $report = ['ok' => true, 'mode' => $mode, 'request_sha256' => hash('sha256', $plain), 'checked_at' => now('Asia/Riyadh')->toIso8601String(), 'result' => $result];
    }
} catch (Throwable $error) {
    $report = ['ok' => false, 'mode' => $mode, 'error_class' => get_class($error), 'message' => $error->getMessage()];
}
assistedProtectedReport($report, $case, $mode ?: 'error');
if (! $report['ok']) exit(1);
echo 'ASSISTED_SMS_'.strtoupper($mode).'_VERIFIED'."\n";
