# Accepted investment SMS review

New Ta3meed acceptance messages enter a pending review queue. Receiving or opening them never creates an opportunity, investor participation, repayment or cash movement. Amount, opportunity reference and funding date are extracted independently. An explicit date takes precedence; otherwise the message send/arrival date is labeled in the form.

**إكمال** opens the existing add-opportunity form with only known fields prefilled. The user enters profit, classification, duration, maturity and investor allocations. Saving calls the existing opportunity writer inside the same transaction as the SMS decision. Owner locks, normalized reference checks, exact participation totals and decision replay protect against duplicates and uncertain network responses. Closing the form returns to pending review.

**إلغاء** discards the pending message, erases its sender, body, monetary values and original message metadata, and removes it from archive results. Minimal delivery IDs and the dismissed state remain to prevent delayed device retries from recreating it. Cancellation never deletes an existing investment or cancels an investment at the external platform.

Previously archived acceptance messages become reviewable when listed, without rewriting financial history. Other senders and payment-review endpoints cannot enter this flow. The server and actual existing form are tested using synthetic inputs and an isolated in-memory database. JavaScript is delivered to web and the existing 1.0.23 runtime; no native changes or APK rebuild are required.
