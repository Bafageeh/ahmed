# Ta3meed cash wallet

Open **Investments → Ta3meed → Ta3meed wallet** using the wallet shortcut or the Ta3meed quick menu. The wallet supports a manual opening balance, deposits, withdrawals, notes and operation references. The opening balance represents cash before the recorded movements. It does not import historical receipts, archive messages, investment principal, or investor account balances.

All amounts are stored as signed integer cents. The balance is opening cash plus deposits plus linked repayment receipts minus withdrawals. Manual movements can be edited and voided with a revision check and an audit snapshot. A stable request UUID makes a network retry idempotent. Every endpoint derives ownership from the authenticated session, never a supplied user ID.

Only new accepted `Ta3meed` SMS messages enter the existing ingestion path. Confirmed wallet deposits and withdrawals are recognized conservatively. Future/requested/failed transfers, ambiguous directions or amounts, fee-bearing transfers, and non-wallet bank messages do not change cash. Operation references deduplicate wording changes and device retries. Possible overlaps with a manually entered transfer or a repayment credit are held for review; different explicit references can identify legitimate equal-value transfers.

Opportunity messages retain the existing repayment and investor-allocation path. Every newly created receipt produces one linked wallet credit inside the same transaction. The receipt ID is unique in the wallet. Receipt dates and amounts remain authoritative through a join, and deleting a receipt removes its linked credit from the calculated balance. A failure creating the wallet credit rolls back the receipt and allocations while preserving the incoming message for review.

The existing Android 1.0.23 native receiver and notification protocol are reused. Deposit/withdrawal outcomes use the existing committed `applied` result and notification payload; there are no native changes or new permissions. JavaScript is published to the existing production runtime, web and Expo 8082. SMS still requires the user to enable capture and notification permission on their own device.

Run the isolated memory-only integration suite with:

```sh
php scripts/test-ta3meed-wallet.php /path/to/ahmed
node --experimental-vm-modules scripts/test-sms-client.cjs
```

The suite includes the existing SMS, receipt and investor tests, plus manual balances, signed cent arithmetic, idempotency, concurrent-edit protection, audit-preserving deletion, account isolation, SMS deposits and withdrawals, duplicate/ambiguous transfers, receipt linkage, and failure rollback. Delivery compares the complete inspected source before applying explicit files. Publication verifies the served web bundle and the authenticated EAS production channel, published update group, and installed-runtime compatibility.
