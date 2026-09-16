---
"@everything-dev/activity-plugin": minor
---

Add an admin history import that reports, and optionally enqueues, the legacy activity rows that
would be forwarded to activity.nearbuilders.org. It is a dry run by default, is idempotent through
the same outbox as live dual-write, derives stable idempotency keys for rows that predate them,
retracts rows hidden before the import, and reports how many events would move into the current
leaderboard period because Activity timestamps events on receipt.
