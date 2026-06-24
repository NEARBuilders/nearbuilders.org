---
"@everything-dev/activity-plugin": minor
"api": minor
---

Add activity plugin with a public activity ledger and leaderboard (#31).

- **activity plugin**: New generic activity store following the every-plugin scaffold — oRPC contract (`emitActivity`, `getActivityFeed`, `subscribeActivity`, `getLeaderboard`), an Effect-TS service backed by a Drizzle PostgreSQL schema (`activity_events`), and a `MemoryPublisher` for SSE streaming. Events are entity-agnostic so any source (manual uploads, NearCatalog claims, future NEARN/GitHub/IronClaw) can push them in. The leaderboard aggregates per-actor `eventCount` and `endorsementScore` (verified × 2, otherwise × 1) across `week`/`month`/`all-time` periods, sorted descending.
- **api**: Passthrough for the activity routes — `emitActivity` (requireAuth, the only write path), `getActivityFeed` (public, pagination + filter by source/type/actor), `subscribeActivity` (public SSE with filter forwarding), and `getLeaderboard` (public, period-based ranking). SSE `signal`/`lastEventId` are forwarded so reconnects resume cleanly.
- **infra**: New `postgres-activity` container and `ACTIVITY_DATABASE_URL` env var; existing plugin postgres ports shifted to avoid collisions.