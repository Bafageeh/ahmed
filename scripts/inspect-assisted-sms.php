<?php
// Read-only database inspection. Public Actions logs contain encrypted reports only.
ini_set('display_errors', '0');
$root = getenv('AHMED_SMS_ROOT');
$case = getenv('AHMED_SMS_CASE');
$public = file_get_contents($case.'/report-public.pem');
$connection = null;
$report = ['ok' => false];
try {
    require $root.'/ahmed-api/vendor/autoload.php';
    $app = require $root.'/ahmed-api/bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $connection = Illuminate\Support\Facades\DB::connection();
    $driver = $connection->getDriverName();
    if ($driver === 'sqlite') { $connection->statement('PRAGMA query_only=ON'); $connection->beginTransaction(); }
    elseif ($driver === 'mysql') { $connection->statement('SET TRANSACTION READ ONLY'); $connection->beginTransaction(); }
    elseif ($driver === 'pgsql') { $connection->beginTransaction(); $connection->statement('SET TRANSACTION READ ONLY'); }
    else throw new RuntimeException('Unsupported read-only driver');
    $owner = $connection->table('users')->where('id', 1)->where('username', 'admin')->first(['id', 'username', 'name']);
    if (! $owner) throw new RuntimeException('Expected account was not found');
    $messages = [];
    foreach ($connection->table('sms_archive_messages')->where('user_id', $owner->id)->orderByDesc('id')->limit(500)->get() as $row) {
        if ($row->analysis_status === 'dismissed') continue;
        $body = Illuminate\Support\Facades\Crypt::decryptString($row->body);
        if (! preg_match('/3100(?:\.00)?|8775182/u', $body)) continue;
        $messages[] = ['id' => $row->id, 'sender' => Illuminate\Support\Facades\Crypt::decryptString($row->sender), 'body' => $body,
            'received_at_ms' => $row->received_at_ms, 'sent_at_ms' => $row->sent_at_ms, 'analysis_status' => $row->analysis_status,
            'wallet_entry_id' => $row->wallet_entry_id, 'payment_amount' => $row->payment_amount];
    }
    $files = [];
    foreach (['app/Support/Ta3meedSmsParser.php', 'app/Support/Ta3meedWalletSmsParser.php', 'app/Support/Ta3meedWalletLedger.php',
        'app/Support/Ta3meedSmsProcessor.php', 'app/Support/Ta3meedInvestmentSmsParser.php', 'app/Support/Ta3meedSmsReviewData.php',
        'app/Http/Controllers/Api/SmsCaptureController.php'] as $path) $files[$path] = hash_file('sha256', $root.'/ahmed-api/'.$path);
    $report = ['ok' => true, 'checked_at' => now('Asia/Riyadh')->toIso8601String(), 'driver' => $driver,
        'owner' => $owner, 'files' => $files, 'messages' => $messages,
        'devices' => $connection->table('sms_capture_devices')->where('user_id', $owner->id)->get(['id', 'installation_id', 'label', 'enabled', 'capture_from_ms']),
        'wallet_candidates' => App\Support\Ta3meedWalletLedger::active((int) $owner->id)->select('e.*')
            ->selectRaw(App\Support\Ta3meedWalletLedger::amountSql().' as effective_cents')->selectRaw(App\Support\Ta3meedWalletLedger::dateSql().' as effective_date')
            ->where(fn ($q) => $q->where('e.entry_date', '2026-10-26')->orWhere('e.amount_cents', 310000))->orderBy('e.id')->get(),
        'summary' => App\Support\Ta3meedWalletLedger::summary((int) $owner->id)];
    $connection->rollBack();
    if (! is_file($case.'/request-key.pem')) {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        if (! $key || ! openssl_pkey_export($key, $private)) throw new RuntimeException('Could not prepare private request transport');
        file_put_contents($case.'/request-key.pem', $private, LOCK_EX); chmod($case.'/request-key.pem', 0600);
    }
    $key = openssl_pkey_get_private(file_get_contents($case.'/request-key.pem'));
    $report['request_public_key'] = openssl_pkey_get_details($key)['key'];
} catch (Throwable $e) {
    if ($connection && $connection->transactionLevel()) $connection->rollBack();
    $report = ['ok' => false, 'error_class' => get_class($e), 'message' => $e->getMessage()];
}
$json = json_encode($report, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
file_put_contents($case.'/inspection.json', $json, LOCK_EX); chmod($case.'/inspection.json', 0600);
$key = random_bytes(32); $iv = random_bytes(12);
$cipher = openssl_encrypt(gzencode($json, 9), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
if (! openssl_public_encrypt($key, $wrapped, $public, OPENSSL_PKCS1_OAEP_PADDING)) throw new RuntimeException('Report protection failed');
$encoded = strtoupper(bin2hex(json_encode(['key' => base64_encode($wrapped), 'iv' => base64_encode($iv), 'tag' => base64_encode($tag), 'ciphertext' => base64_encode($cipher)])));
foreach (str_split($encoded, 4000) as $i => $part) echo 'ASSISTED_SMS_REPORT_PART_'.$i.'='.$part."\n";
if (! $report['ok']) exit(1);
