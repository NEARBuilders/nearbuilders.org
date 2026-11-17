### Context
This is a child ticket of #23, to work towards a full view of ecosystem contributions. This introduces a public activity ledger that aggregates events from different sources, such as manual uploads, NearCatalog claims, and future NEARN/GitHub/IronClaw integrations. The notifications plugin (#30) handles notifying users about events; this plugin tracks what actually happened. Follows the same generic pattern as `plugins/votes/` and `plugins/notifications` — entity-agnostic, cross-cutting, any source pushes events in.

### Overview
Create `plugins/activity` following the [every-plugin](https://tanstack.com/intent/registry/every-plugin) framework. You will need to implement the Drizzle schema, oRPC contract, Effect-TS service with MemoryPublisher for SSE streaming, and wire into `api/src/contract.ts` as passthrough. The contract should include `emitActivity` (for sources to push events), `getActivityFeed` (paginated + filterable by source/type/actor), `subscribeActivity` (SSE), and `getLeaderboard` (server-side ranked scores computed as event count × endorsement weight). Register in `bos.config.json` and run `bos types gen`.

### Acceptance Criteria
- [ ] `plugins/activity` following every-plugin scaffold (contract, service, schema, migrator)
- [ ] Drizzle schema: `activity_events` — `id`, `source` (string: "manual"|"nearn"|"github"|"nearcatalog"|"ironclaw"|...), `type` (string: "upload"|"bounty"|"pr"|"commit"|"claim"|"participation"|...), `actor` (NEAR account), `payload` (jsonb), `verified` (boolean), `created_at`
- [ ] oRPC contract:
  - `emitActivity` — POST `/v1/activity`, input `{ source, type, actor, payload, verified? }`, output `ActivityEvent`
  - `getActivityFeed` — GET `/v1/activity`, input `{ source?, type?, actor?, limit?, cursor? }`, output paginated `{ data: ActivityEvent[], meta }`
  - `subscribeActivity` — GET `/v1/activity/stream`, input `{ source?, type?, actor? }`, output SSE event iterator
  - `getLeaderboard` — GET `/v1/activity/leaderboard`, input `{ period: week|month|all-time, limit? }`, output `{ actor, eventCount, endorsementScore, topSources }[]` sorted descending
- [ ] Effect-TS service with Drizzle repository
- [ ] MemoryPublisher for SSE streaming (follows `plugins/votes/src/index.ts` pattern)
- [ ] Registered in `bos.config.json` with `ACTIVITY_DATABASE_URL` secret, `production` URL, `integrity`
- [ ] API passthrough in `api/src/contract.ts`: `emitActivity` (requireAuth), `getActivityFeed` (public), `subscribeActivity` (public), `getLeaderboard` (public)
- [ ] API handler in `api/src/index.ts` delegates to `services.plugins.activity(pluginContext(context))`
- [ ] `bos types gen` regenerates `ui/src/lib/api-types.gen.ts`
- [ ] `bun typecheck` passes
- [ ] Must follow everything-dev and every-plugin best practices
