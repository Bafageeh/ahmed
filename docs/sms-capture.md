# New SMS capture

Enable from **More → SMS messages** in the installed Android APK. Collection is disabled until the user turns it on and grants `RECEIVE_SMS`.

The native receiver reads only incoming `SMS_RECEIVED` broadcasts. It requests no historical inbox permission. Multipart text is joined, and the original sender address or sender ID, full text, arrival time, original send time and available SIM information are retained. Arrival time determines the activation cutoff, so a newly arriving delayed message remains eligible.

Messages and the device upload credential are encrypted with an Android Keystore key and stored under `noBackupFilesDir`. A network-constrained Android job uploads queued records, with a periodic retry as a safety net. Each message retains its client UUID across retries.

`POST /api/sms/devices` registers an installation under the authenticated Ahmed account. Its returned credential can write only to `POST /api/sms/ingest`. It cannot read the archive or account information. The archive encrypts both sender and text, enforces device/message uniqueness, and returns only the authenticated account's records from `GET /api/sms/messages`.

Disabling capture stops collection immediately, including offline. Pending records remain associated with their original account. Re-enabling that account reconnects and uploads its queue. Logout or a different account disables the native connection. Android force-stop prevents reception until the app is opened again; system-protected verification messages may be withheld by Android.

## Verification

The server checks use an isolated SQLite memory database:

```sh
php scripts/test-sms-capture.php /path/to/ahmed
node --experimental-vm-modules scripts/test-sms-client.cjs
```

Coverage includes sender and whitespace preservation, encrypted storage, activation cutoff, delayed messages, idempotent retries, account isolation, revocation, offline stop, missing permission and account switches during permission or registration requests.

The release workflow compares the reviewed production source hashes before applying explicit files. It preserves the current investor and updater changes, migrates only the new SMS tables, verifies the live API and Metro bundle, builds Android in GitHub Actions, and verifies its certificate against the previous published APK. The build number increases above the previous APK. The APK gate checks `RECEIVE_SMS`, absence of `READ_SMS`, and preservation of the existing income widget before publishing.
