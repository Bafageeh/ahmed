# Play Protect review status — Ahmed 1.0.22

Status: Appeal successfully submitted to Google on 2026-10-25. The authenticated form displayed “Your email has been sent”. Google Play Protect approval or removal of the installation block has not been confirmed.

Official appeal form: https://support.google.com/googleplay/android-developer/contact/protectappeals

## Application details

- Application name: Ahmed
- Package: sa.pm.ahmed
- Android version: 1.0.22
- Version code: 25
- APK: https://pm.sa/downloads/ahmed-sms-1.0.22.apk
- APK SHA-256: f77346a16586785f812f70cc82ba22672a309441d5b11c433f221b6685e626c9
- Signing certificate SHA-256: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
- Contact email: selected from the owner's connected account and populated in the form; omitted from this source document.

## Proposed additional information

Please review the installation block for Ahmed, package sa.pm.ahmed, version 1.0.22 (25). The device displays: “This app can request access to sensitive data. This can increase the risk of identity theft or financial fraud.”

The owner explicitly requested an optional backup of newly arriving SMS messages, including the sender, full text and arrival time, into the owner's authenticated Ahmed account for later analysis.

The feature is disabled by default. The SMS screen explains the collection and server transfer before the owner enables it. Android RECEIVE_SMS permission is requested at activation. The receiver processes only newly delivered SMS_RECEIVED events after activation. It does not query the historical SMS inbox and does not request READ_SMS. It does not send SMS messages or retrieve contact names.

The SMS module does not use accessibility or notification-listener access. Queued text and the upload credential are encrypted with an Android Keystore key in noBackupFilesDir. Uploads use HTTPS to https://ahmed.pm.sa/api/sms/ingest with a dedicated revocable, account-scoped write-only device credential. The server encrypts sender and body. Reading archived messages requires the account's separate login credential. Retries are idempotent.

Capture can be disabled in the SMS screen, including offline, and is disabled on logout or a switch to another account. The archive belongs to the authenticated account. OS-protected messages that Android withholds are not bypassed.

The APK's signature matches the previously published Ahmed APK. We request review of this opt-in SMS backup use case and the installation block against Google's applicable policies. We do not claim that passing build or signature checks constitutes Play Protect approval.

## Submission progress

The owner explicitly authorized sharing this APK with Google and VirusTotal on 2026-10-25. The exact APK was downloaded, checked against the SHA-256 above, and uploaded to VirusTotal.

- Verified VirusTotal report: https://www.virustotal.com/gui/file/f77346a16586785f812f70cc82ba22672a309441d5b11c433f221b6685e626c9?nocache=1
- Completed report displayed 1/66 vendors flagging the file: AhnLab-V3, `PUP/Android.Malct.518314`. Other results include undetected, unsupported types, a timeout and failures. This is not a determination that the APK is safe or malicious, and is not Google Play Protect approval.
- Google's appeal form was populated with the selected contact address, developer name, package and exact APK hash. Supporting text was shortened to the form's 1,000-character maximum (976 characters, including the VirusTotal result).
- The first submission attempt while signed out displayed “Complete the reCAPTCHA to continue”; it was not a successful submission.
- On resuming after owner handoff, the existing browser was signed into the selected Google account. The form had cleared, so the authorized fields were restored without changing the APK or appeal scope.
- The authenticated form was submitted once. Its visible form contents were replaced by the confirmation heading “Your email has been sent”. Submission is confirmed; no case number was shown. Google states that appeal decisions are final and that applicants will not receive a response.
- No Google approval or lifting of the installation block is claimed. Do not resubmit this appeal merely because the warning remains.
- No home-computer access, Play Protect disabling or package/signature change was used.

Official warning guidance: https://developers.google.com/android/play-protect/warning-dev-guidance
