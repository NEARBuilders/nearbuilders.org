---
"api": minor
"@everything-dev/proposals-plugin": minor
---

Add the admin review digest and automatic review evaluation.

- `GET /reviews/digest` summarizes actionable review work (pending proposals plus failed or stalled lifecycle operations) with submitter, detail, oldest wait, recent decisions, weekly median review time, and each item's current evaluation. It requires an API key with the `reviews:read` permission; such keys can also read private proposal queues, review history, and evaluations without gaining moderation rights.
- A background sweep evaluates pending proposals with deterministic checks (GitHub repository activity, domain resolution, NEAR account existence, duplicates, event dates, builder status) and, when `ANTHROPIC_API_KEY` is set, a Claude assessment. Results are advisory, stored per proposal submission in the new `proposal_evaluations` table, and a failed hard check can never be marked ready. `POST /reviews/evaluate` (admin) runs a sweep on demand.
- Evaluations record the submission source and add checks for same-name builders, duplicate events, and newly created repositories. Items without a Claude assessment are never marked ready and are retried later. A database lease ensures only one API instance runs the sweep.
- `POST /reviews/telegram-decision` lets admins with a linked Telegram account approve or reject from the admin group, through the same path as the dashboard and recorded under their own account, with a dry-run mode for validation. Requires the `reviews:write` API key permission.
- Telegram linking: the `/link` command of Chief (the admin review bot) calls `POST /reviews/telegram-links` for a one-time, 10-minute code; the admin confirms it at `/admin/telegram-link` while signed in. The new admin dashboard **Telegram** tab lists linked accounts and removes access. Adds the `telegram_link_codes` and `telegram_reviewers` tables (proposals migration `0003`).
- The admin dashboard shows each pending item's evaluation badge, and the review sheet shows the summary, flags, checks, and a Re-evaluate action (`GET /reviews/evaluations`, `POST /reviews/{pluginId}/{entityId}/evaluate`).
- Optimistic concurrency checks compare `updated_at` at millisecond precision, so rows written outside the app can be approved.
