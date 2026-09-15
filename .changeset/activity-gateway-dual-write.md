---
"@everything-dev/activity-plugin": minor
---

Add a reversible path that forwards trusted activity to activity.nearbuilders.org. A mode stored in
the database (`legacy-only` by default, then `dual-write` or `standalone-only`) is switchable by an
administrator without a redeploy, an outbox records every forwarded write with its idempotency key
and the returned Activity event ID, hidden events are retracted, and failures are retried and
reported instead of being swallowed. See `plugins/activity/README.md`.
