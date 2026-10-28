# New SMS capture

## Ta3meed-only automatic repayments (Android 1.0.23)

Only the complete sender ID `Ta3meed` is accepted, case-insensitively and with surrounding whitespace ignored. The Android receiver checks it before opening the queue or persisting content; the server independently enforces the same rule. Excluded records still pending from a previous version are discarded locally, or acknowledged without archive storage by the server. Historical archive contents are retained; they are never retroactively submitted as payments.

New accepted messages retain their original sender, body, and arrival/sent timestamps. Each is analyzed once during ingestion. A confirmed repayment needs a single opportunity reference belonging to the same authenticated account, one unambiguous positive amount, and a valid payment date. Arabic digits and decimal/thousands separators are recognized. The confirmed “تم إضافة سداد جزئي” format is accepted automatically, including when the amount precedes the opportunity reference. Reminders, future payments, marketing, and verification messages do not change the ledger. Missing or conflicting information, excessive amounts, a closed opportunity, or a possible wallet cash overlap are held for review.

Incoming partial repayments match existing receipts by account, opportunity, amount and payment calendar date. An equal receipt on that date is returned as a duplicate and linked without another receipt, investor allocation or wallet credit, even when it was entered manually or its SMS text differs. The same amount on another date, or a different amount on the same date, can be applied as a new partial repayment. The explicit SMS payment date takes priority; otherwise the valid original send timestamp, then the arrival timestamp, supplies the date in Asia/Riyadh. Full and early-settlement review rules and deliberately confirmed manual approvals are preserved. Previously archived messages are not automatically reprocessed.

Automatic payments use the existing receipt and investor allocation writer. Partial receipts update remaining balances; full or early settlements update status and actual profit. Opportunity funding dates are preserved. An account row lock serializes device ingestion, and the opportunity row lock serializes receipt writes. Stable device/client IDs, normalized body plus payment date fingerprints, and existing-ledger checks prevent retry and cross-device duplication. Identical partial-payment text on different payment dates is not permanently suppressed.

The payment, allocations, and successful analysis are committed before the API returns an `applied` result. A failure inside the receipt writer rolls back its changes while retaining the SMS as needing review. Android displays completion notifications only from these committed outcomes, never from parsing the SMS locally. Notification tags and persisted handled IDs prevent repeated alerts on network retries. Review notifications have distinct wording and never claim completion. Android notification permission must be granted to show background alerts; every result remains visible in the SMS archive.

An older all-sender native module is disabled by the updated JavaScript and cannot be re-enabled until the filtered Android update is installed. New capture still requires user activation and `RECEIVE_SMS`; no `READ_SMS` or historical inbox import is added.

The isolated integration suite covers actual partial/full/early receipt writes and investor allocation, Arabic amounts, retries, multiple devices, account isolation, malformed and ambiguous messages, excluded sender aliases, receipt rollback on an allocation failure, and the returned completion/review outcome. The JavaScript suite covers SMS and notification permission, offline stop, old-version gating, and account switching during both permission prompts and registration.

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
