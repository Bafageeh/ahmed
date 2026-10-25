# Play Protect review draft — Ahmed 1.0.22

Status: prepared for owner review; not submitted.

Official appeal form: https://support.google.com/googleplay/android-developer/contact/protectappeals

## Application details

- Application name: Ahmed
- Package: sa.pm.ahmed
- Android version: 1.0.22
- Version code: 25
- APK: https://pm.sa/downloads/ahmed-sms-1.0.22.apk
- APK SHA-256: f77346a16586785f812f70cc82ba22672a309441d5b11c433f221b6685e626c9
- Signing certificate SHA-256: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
- Contact email: to be supplied by the owner.

## Proposed additional information

Please review the installation block for Ahmed, package sa.pm.ahmed, version 1.0.22 (25). The device displays: “This app can request access to sensitive data. This can increase the risk of identity theft or financial fraud.”

The owner explicitly requested an optional backup of newly arriving SMS messages, including the sender, full text and arrival time, into the owner's authenticated Ahmed account for later analysis.

The feature is disabled by default. The SMS screen explains the collection and server transfer before the owner enables it. Android RECEIVE_SMS permission is requested at activation. The receiver processes only newly delivered SMS_RECEIVED events after activation. It does not query the historical SMS inbox and does not request READ_SMS. It does not send SMS messages or retrieve contact names.

The SMS module does not use accessibility or notification-listener access. Queued text and the upload credential are encrypted with an Android Keystore key in noBackupFilesDir. Uploads use HTTPS to https://ahmed.pm.sa/api/sms/ingest with a dedicated revocable, account-scoped write-only device credential. The server encrypts sender and body. Reading archived messages requires the account's separate login credential. Retries are idempotent.

Capture can be disabled in the SMS screen, including offline, and is disabled on logout or a switch to another account. The archive belongs to the authenticated account. OS-protected messages that Android withholds are not bypassed.

The APK's signature matches the previously published Ahmed APK. We request review of this opt-in SMS backup use case and the installation block against Google's applicable policies. We do not claim that passing build or signature checks constitutes Play Protect approval.

## Submission preparation

The official form requests an email address, package name, the SHA-256 of the APK uploaded to VirusTotal, and supporting information. A VirusTotal upload/report has not been confirmed. No APK has been uploaded to a new scanning service and no appeal has been submitted as part of preparing this draft. Owner authorization and the intended contact email are needed before external submission.

Official warning guidance: https://developers.google.com/android/play-protect/warning-dev-guidance
