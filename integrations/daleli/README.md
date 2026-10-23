# Daleli income integration

`ahmed-summary.php` replaces the static COM response at the existing Ahmed summary entry points. The guarded Ahmed publishing workflow backs up and verifies each existing file before installing this source. It does not deploy or reset the COM application.

The calculation matches the live COM mobile summary: unblocked hosting income, minus annualized manual expenses and unblocked domain renewals, divided by 24 for the monthly personal share. Only database aggregates are read; individual records are never returned. Failed queries return HTTP 503 and never a fixed fallback.
