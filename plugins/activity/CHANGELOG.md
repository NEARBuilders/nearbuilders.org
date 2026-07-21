# @everything-dev/activity-plugin

## 1.1.0

### Minor Changes

- 770d16e: Add activity plugin with a public activity ledger and leaderboard (#31).

  - **activity plugin**: New generic activity store following the every-plugin scaffold — oRPC contract (`emitActivity`, `getActivityFeed`, `subscribeActivity`, `getLeaderboard`), an Effect-TS service backed by a Drizzle PostgreSQL schema (`activity_events`), and a `MemoryPublisher` for SSE streaming. Events are entity-agnostic so any source (manual uploads, NearCatalog claims, future NEARN/GitHub/IronClaw) can push them in. The leaderboard aggregates per-actor `eventCount` and `endorsementScore` (verified × 2, otherwise × 1) across `week`/`month`/`all-time` periods, sorted descending.
  - **api**: Passthrough for the activity routes — `emitActivity` (requireAuth, the only write path), `getActivityFeed` (public, pagination + filter by source/type/actor), `subscribeActivity` (public SSE with filter forwarding), and `getLeaderboard` (public, period-based ranking). SSE `signal`/`lastEventId` are forwarded so reconnects resume cleanly.
  - **infra**: New `postgres-activity` container and `ACTIVITY_DATABASE_URL` env var; existing plugin postgres ports shifted to avoid collisions.

- c801c40: Complete the reviewed NEAR Catalog claim lifecycle and public presentation for issues #54 and #55.

  - Derive manual activity identity from authentication, add trusted admin-only activity emission, make emitted events idempotent, and support hiding revoked activity from feeds and leaderboards.
  - Apply approved Catalog claims through a compensating workflow that verifies current builder and Catalog state, records a verified activity snapshot, and safely retries or rolls back partial failures.
  - Support rejected and removed claim resubmissions while preserving proposal history, and expose complete claim review, retry, rejection, and revocation controls to administrators.
  - Present claimed Catalog contributions on builder profiles, render specialized claim activity, and merge current Catalog projects into the public and personal project directories without duplicating local projects.
