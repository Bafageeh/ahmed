# Investment acceptance: تم الرفع

Accepted-investment SMS remain pending until the account owner acts. Receiving or viewing a message never deducts cash. Existing archive messages and financial history are not backfilled.

- **إكمال** opens the existing add-opportunity form. Saving creates the opportunity and its actual investor allocations; it still does not debit cash.
- **تم الرفع** confirms that the opportunity is already entered. The server extracts its reference, capital and date from the original SMS, finds one matching Ta3meed opportunity owned by the authenticated account, verifies exact capital, and records one negative wallet entry with an audit. The wallet names this entry **تمويل فرصة** and includes it in outgoing cash.
- **إلغاء** discards an unfinished acceptance without an opportunity or financial movement. A funded acceptance cannot be discarded through this action.

Funding, its audit, and the final SMS decision commit in one account-locked transaction. A unique owner/opportunity link prevents repeat deductions across retries, devices, different SMS IDs and delivery dates. Repeated acceptance messages link to the existing debit. Ambiguous references, another owner's opportunity, a different platform, changed capital, invalid dates, cancelled opportunities and possible existing manual deductions block cash changes with an explanation.

`POST /api/sms/messages/{id}/investment/uploaded` requires the current authenticated review version. Its request contains no editable amount or opportunity identifier. Successful responses include the linked analysis, committed wallet summary and replay flag. Original SMS content remains encrypted and unchanged.

The additive migration only adds nullable wallet links and a unique index. Native runtime, SMS permissions, capture policy and the owner's enabled/disabled capture preference are unchanged. Publish web and production OTA; do not build an APK unless requested.
