# Security audit: endpoints, auth coverage and error handling

Audit for #321. It covers every oRPC procedure in the core API contract (`api/src/contract.ts`) and in the ten local plugins (activity, apps, bookmarks, builders, credits, events, nearcatalog, notifications, projects, proposals, votes). The `nostr` plugin is a remote (`bos://nearbuilding.near/nostr.nearbuilders.org`) and is out of scope.

Line numbers refer to `main` at `bd322ed` (31 Oct 2026). Three findings were fixed on `main` after that (#340, #343, #344). They are listed under Fixed findings, and the route tables below show the posture after those fixes.

## How requests reach the code

Three facts shape most of the findings.

1. **Every plugin router is public.** The everything.dev host registers each plugin router at `/api/rpc/<plugin>/<procedure>` (`everything-dev/host/src/routes/api.ts`, `registerPublicRpcRouter`). The plugin gets the same session context as the core API. A plugin route is reachable directly, so a check that exists only in the core wrapper isn't a check for that route.
2. **The core API is exposed three ways.** It's served as oRPC at `/api/rpc`, as OpenAPI at `/api/*`, and through MCP at `/api/mcp`. All three share the middleware below.
3. **Rate limiting is host-global.** The host allows about 2000 requests per 15 minutes per client IP (`RATE_LIMIT_MAX`). `/api/rpc/*` is exempt from the stricter mutation tier, because every oRPC call is a POST. No procedure in this repo adds its own limit, so the rate-limit column is left out of the tables.

### Auth middleware (`api/src/lib/auth.ts`)

| Middleware | Passes when | Context it hands on |
|---|---|---|
| `requireAuth` | session user present | `userId`, `user` |
| `requireAuthOrApiKey` | session user **or** API key | the raw context, so with a key alone `userId` may be undefined |
| `requireRole` / `requireAdmin` | session user with `role` in the list | `userId`, `user` |
| `requireOrganization` / `requireOrgRole` | active org (and member role) | org context |
| `requireApiKey(perms)` | API key holding every listed permission | `apiKey` |

Plugins don't import this file. Each defines its own `requireAuth`/`requireAdmin` (and, in builders, `requireApiKey`) inside `createRouter`. They match the core semantics, except that activity's `requireAuth` also needs a NEAR account.

No route uses `requireOrganization` or `requireOrgRole`. Org scoping in projects is enforced inside the service (`assertOrganizationAttribution`, `canEditProject`).

### Error handling

Plugin handlers are Effect generators (`.effect(function* …)`). Failures reach the client in three ways:

- **Typed.** `ORPCError` or contract `errors.X(...)`. Fine.
- **Generic.** A defect from `Effect.promise` is rethrown, and oRPC turns it into a plain 500. Used in proposals, votes and bookmarks. Nothing leaks, but the failure is a defect rather than a typed error.
- **Leaky.** The helper copies `error.message` into an `INTERNAL_SERVER_ERROR`. This covers projects `toRouteError` (`plugins/projects/src/index.ts:16`), builders `runService` (`plugins/builders/src/index.ts:15`), events `internalError` (`plugins/events/src/index.ts:13`), credits `attempt` (`plugins/credits/src/index.ts:11`), and the generated `runEffect` in every `lib/context.ts`. With drizzle-orm 0.45 a database error message is `Failed query: <SQL> params: <values>`, so the response carries the SQL text. See M-3.

No core handler uses `Effect.promise`, `Effect.die` or `catchAll`. The two core `runEffect` calls (`api/src/index.ts:299`, `:756`) are admin-only.

## Findings

Severity: **High** means any user can act on someone else's data or skip moderation. **Medium** means a real gap that needs a precondition or only leaks data. **Low** means hardening. **Info** means noted, no action needed.

### Fixed findings

| ID | Sev | Finding | Fixed in |
|---|---|---|---|
| H-1 | High | Some core-only checks could be skipped by calling the plugin route directly. Activity registration ran its project owner, status and approval checks only in core `registerProjectActivity`. Project and event creation applied the NEAR-account and visibility rules only in core, and a create with an existing id didn't check who owned it. | #340: activity registration now runs only through core (server-only context marker); the projects and events plugins apply the NEAR-account and visibility rules themselves and refuse an existing id unless the caller owns it. |
| H-2 | High | Resubmitting a proposal for an existing entity replaced its payload without checking who first submitted it. | #343: only the original submitter, the builder themself, an admin, or (through core) someone who can edit the project or event can resubmit. |
| H-3 | High | The nomination bot routes accepted any API key, and any signed-in user can mint a key. | #344: these routes need a key that belongs to an admin or carries the admin-granted `nominations:write` permission. |

### Open findings

| ID | Sev | Finding | Where | Proposed fix |
|---|---|---|---|---|
| M-1 | Medium | A collaborator or org member who can edit a project can have their proposal approved, and the reviewed apply then rewrites the project's `ownerId` to the proposer. | `api/src/services/proposal-orchestration.ts:142-158`; `plugins/projects/src/services/projects.ts:1137` | Before applying, require the existing project's `ownerId` to equal the proposal owner; stop passing owner as a transfer. |
| M-2 | Medium | Self-reported activity can be forwarded as a trusted gateway event. `emitActivity` lets a user pick any `source`/`type` (stored `verified=false`), and `importActivityHistory` forwards every legacy row whose `source:type` is a gateway type, ignoring `verified`. | `plugins/activity/src/index.ts:241-259`; `services/activity-import.ts:91-102` | Force `source` to the self-reported source in `emitActivity`; filter the import on `verified = true`. |
| M-3 | Medium | Database error text, including SQL and bound params, is returned to callers. A non-numeric or negative `cursor` is enough to trigger it on public list routes. | projects `toRouteError` (index.ts:16), builders `runService` (index.ts:15), events `internalError` (index.ts:13), `lib/context.ts` `runEffect` in every plugin; cursors at `projects/services/projects.ts:695`, `builders/services/builders.ts:465`, `events/services/events.ts:311`, proposals cursor parsing | Return a fixed message for non-ORPC defects and log the cause; validate `cursor` as `^\d+$` in the contracts. Same for events `eventWriteError` (events.ts:109), which misses unique violations wrapped in the drizzle cause. |
| M-4 | Medium | Public builder proposals expose more than the UI needs: `payload.userId` (internal auth id), raw `applyError` text, and audit `actorLabel`, which falls back to the admin's email when their name is empty. Audit `details` include nomination metadata. | `getProposals`/`getAuditLog` (`api/src/index.ts:793,801`); `plugins/proposals/src/services/proposals.ts:58-60` | Project a public view for non-admins (drop `payload.userId`, `applyError`, audit actor fields); never fall back to email. |
| M-5 | Medium | `finalizeNomination` / `finalizeTelegramNomination` accept any `proposalId` string. A holder of a nomination link who already has a builder profile can mark it submitted and link the nominee's X identity to their own builder. | `plugins/builders/src/index.ts:177-211`; `services/nominations.ts:587-665` | Make these callable only from the core handler (context marker), or have core pass a verified proposal so the plugin checks its entity. |
| M-6 | Medium (latent) | The apps relay routes would sponsor any signed delegate action from the caller's own account: no check on `receiverId`, action type, deposit or gas. Not reachable today, because no `REGISTRY_RELAY_*` secrets are configured and the routes throw. | `plugins/apps/src/services/registry.ts:508-532, 609-631` | Before configuring the relay: require the registry receiver, a single `__fastdata_kv` FunctionCall, zero deposit and a gas cap. |
| L-1 | Low | If saving the NEAR AI session fails, the drizzle error (which includes the refresh token as a bound param) is logged, stored in `credit_claims.error` and returned to admins. | `plugins/credits/src/services/nearai-keys.ts:160`; `services/credits.ts:355-358` | Map store errors to a fixed message before logging or persisting. |
| L-2 | Low | Unbounded inputs: `propose.payload`/`metadata` (`z.unknown()`), `emitActivity` source/type/payload, notification fields, builder `links` (record with no count, length or scheme limit), votes/bookmarks `entityId`. | contracts listed | Add `.max()` limits and a serialized-size cap on `z.unknown()` payloads. |
| L-3 | Low | `z.string().url()` accepts `javascript:` and `data:`. It's used for project `repository`, event `lumaUrl` and registry `repoUrl`/`homepageUrl`/`imageUrl`. React 19 blocks `javascript:` hrefs in the UI, but other consumers (MCP, bots, on-chain readers) get the raw value. | `api/src/contract.ts`, plugin contracts | Reuse the `HttpUrl` helper (`api/src/contract.ts:66`). |
| L-4 | Low | Voter identities are public: `getUpvoteFeed` and `subscribe` return each voter's `userId`, which `getBuildersByUserIds` maps to a NEAR account. Since an upvote on a builder proposal counts as a nomination, who nominated whom is public. Generic `upvote` also skips `nominateBuilder`'s self-nomination block. | `plugins/votes/src/services/votes.ts:137-160` | Drop `userId` from the feed and stream; block self-upvotes on builder proposals. |
| L-5 | Low | `getReviewDigest` accepts any key with `reviews:read`, without the admin-owner check its sibling routes use. Only matters if user keys can get that permission. | `api/src/index.ts:859` | Add `requireAdminKeyOwner`. |
| L-6 | Low | `listClaimedCatalogProjects` (public) makes one uncached upstream call per claimed project on every request. | `plugins/nearcatalog/src/index.ts:97-118` | TTL-cache `getProject`. |
| L-7 | Low | `bookmark` ignores every insert error and reports success. | `plugins/bookmarks/src/services/bookmarks.ts:19` | Ignore only unique violations. |
| I-1 | Info | `listEventParticipants` is public and returns `displayName`, which `joinEvent` sets to `user.name ?? user.email`. | `plugins/events/src/index.ts:200` | Don't fall back to email. |
| I-2 | Info | Credits `clientIp` trusts `cf-connecting-ip`. It only feeds an admin heuristic. | `plugins/credits/src/services/credits.ts:44` | Use the host's client key. |
| I-3 | Info | `authHealth` tells signed-in users whether email and SMS providers are configured. | `api/src/index.ts:521` | Admin-only, or drop. |

Things checked and found fine:
- No server-side fetch of user-supplied URLs (logos, avatars, Luma, FastKV, NEAR Catalog, activity gateway): every host is fixed config and path parts are encoded. No SSRF.
- Secrets (`ACTIVITY_GATEWAY_API_KEY`, `LUMA_CALENDAR_API_KEYS`, `NEARAI_API_KEY`) are only sent as headers and never logged or returned.
- Nomination tokens are HMAC-SHA256 with `timingSafeEqual`; only hashes are stored.
- No plugin route takes the acting user from input. All use `context.userId` or `context.near.primaryAccountId`.
- Context markers set by the core API (`serverNotification`, `allowPrivateSubmission`, `allowPublicVisibility`, `activityRegistration`, `canResubmitForOthers`, the evaluator symbol) can't be set by an HTTP caller.
- NEAR AI keys are returned once on claim; only `keyPrefix`/`keyId` are stored.

## API-key acceptance

Today only `propose` accepts keys among user write routes (via `requireAuthOrApiKey`), along with the bot routes. Any signed-in user can mint a key in Settings, so "accepts a key" should always mean "acts as the key's owner", and trusted-bot behaviour should come from an explicit permission plus who owns the key.

Recommendation:
- **Keep session-only:** admin routes, credits claims, profile and account changes, collaborator management.
- **Allow scoped keys** (owner identity, explicit permission such as `projects:write`) for MCP and agent flows: `propose`, `createProject`/`updateProject`, `emitActivity`, votes and bookmarks. That needs `requireAuthOrApiKey` to resolve `userId` from the key owner.
- **Bot routes** (Telegram, X): one shared rule for all of them. The review routes need `reviews:write` plus an admin-owned key; since #344 the nomination routes need an admin-owned key or `nominations:write`. Converging on one rule (permission plus admin owner) is part of ticket 14.

## Proposed fix tickets

Not filed. Titles and severities for triage:

1. Medium: Check project ownership before applying a reviewed project proposal (M-1)
2. Medium: Keep self-reported activity out of the gateway import (M-2)
3. Medium: Return fixed messages for internal errors and validate list cursors (M-3)
4. Medium: Public view for builder proposals and audit logs (M-4)
5. Medium: Only finalize nominations from the core handler (M-5)
6. Medium: Restrict the apps relay to registry writes before enabling it (M-6)
7. Low: Keep NEAR AI session errors out of logs and claim rows (L-1)
8. Low: Size limits on free-form inputs (L-2)
9. Low: Use `HttpUrl` for stored links (L-3)
10. Low: Stop exposing voter ids; block self-upvotes on builder proposals (L-4)
11. Low: Admin-owner check on `getReviewDigest` (L-5)
12. Low: Cache NEAR Catalog lookups for claimed projects (L-6)
13. Low: Surface bookmark insert failures (L-7)
14. Design: Decide API-key acceptance per write route and resolve the key owner as the actor

## Per-route posture

Legend:
- **Pub:** no middleware
- **Auth:** session required
- **AoK:** session or API key
- **Adm:** admin role
- **Key(p):** API key with permission p
- **Key (bot):** API key that belongs to an admin or carries `nominations:write`
- **Core:** reached only in-process with a server-only context marker; not callable over HTTP

"Owner" means the service checks that the caller owns or co-edits the row.

Validation is Zod on every route. The column notes only gaps.

### Core API (`api/src/index.ts`)

| Route(s) | Auth | Ownership / admin | Validation gaps | Errors |
|---|---|---|---|---|
| ping, getApprovalSettings | Pub | – | – | – |
| authHealth | Auth | – | – | typed |
| createTelegramNomination, createXNomination, claimTelegramNomination | Key (bot), enforced in plugin | – | – | passthrough |
| submitBuilderProfile | Auth | caller's own NEAR account; duplicate and pending guards | – | typed |
| nominateBuilder | Auth | NEAR account; no self-nomination | – | passthrough |
| propose | AoK | builders via `nominateBuilder`; private plugins need the core marker; resubmitting needs edit rights on the project or event (H-2) | payload/metadata unbounded (L-2) | passthrough |
| approve, reject, dismissFailure, reopen, remove | Adm | admin | – | raw message to admin |
| withdraw | Auth | creator or subject | – | typed |
| getProposals, getProposalCount, getAuditLog, subscribeProposals | Pub | private plugins hidden (M-4) | cursor (M-3) | passthrough |
| getReviewEvaluations, reevaluateProposal, getProposalSubmissions, getReviewHistory | Adm | admin | – | passthrough |
| decideTelegramReview, claimTelegramLink | Key(reviews:write) | admin-owned key | – | typed |
| getReviewDigest | Key(reviews:read) | no admin-owner check (L-5) | – | passthrough |
| createTelegramLink, listTelegramReviewers, removeTelegramReviewer | Adm | admin | – | typed |
| upvote, downvote, getUserVote(s) | Auth | caller's own rows | entityId unbounded | passthrough |
| getUpvoteCount(s), getUpvoteFeed, subscribeUpvotes | Pub | – (L-4) | – | passthrough |
| bookmark, unbookmark, getUserBookmark | Auth | caller's own rows | entityId unbounded | passthrough |
| searchCatalogProjects, listCatalogCategories, getCatalogProject, listCatalogClaims, listClaimedCatalogProjects | Pub | – | – | typed |
| submitCatalogClaimProposal, getMyCatalogClaimProposals | Auth | own builder profile | – | passthrough |
| emitActivity | Auth | actor forced to caller, unverified | unbounded (L-2) | passthrough |
| registerProjectActivity | Auth | owner, active, approved | – | typed |
| getProjectActivity(+Events, Contributors), getActivityFeed, subscribeActivity, getLeaderboard | Pub | – | – | generic |
| activity gateway status/mode/retry/import/redate | Adm | admin | – | passthrough |
| getMyNotifications, markNotificationAsRead, markAll, subscribe | Auth | caller's own rows | – | passthrough |
| listProjects, getProject, getProjectBySlug, listProjectsForApp, listMentions, listMentionedBy, listCollaborators | Pub | visibility rules | cursor (M-3) | passthrough |
| createProject | Auth | NEAR account, visibility, categories | `repository` scheme (L-3) | passthrough |
| updateProject | Auth | owner/collaborator; public needs admin or approval off | `repository` scheme | passthrough |
| deleteProject | Auth | owner or admin | – | passthrough |
| inviteCollaborator, removeCollaborator, respondCollaborator, listMyCollaborations | Auth | owner / invitee / self | – | passthrough |
| listEvents, getEvent, getEventBySlug, listEventParticipants | Pub | visibility rules | cursor (M-3) | passthrough |
| joinEvent, leaveEvent | Auth | self | – | passthrough |
| createEvent | Auth | NEAR account; private for non-admins | `lumaUrl` scheme | passthrough |
| updateEvent, deleteEvent | Auth | owner | – | passthrough |
| listLumaCalendars, listLumaEvents, getLumaEvent | Pub | private calendars admin-only | – | typed |
| listBuilders, getBuilder, getBuildersByUserIds, getBuilderStats | Pub | withdrawn profiles hidden | cursor (M-3) | passthrough |
| getMyBuilderProfile, withdraw/restoreMyBuilderProfile, updateBuilderProfile | Auth | own profile | `links` unbounded (L-2) | passthrough |
| listRegistryApps, getRegistryAppsByAccount, getRegistryApp, getRegistryStatus, prepareRegistryMetadataWrite | Pub | – (prepare only builds a tx the user signs) | url schemes (L-3) | passthrough |

### Plugins called directly (`/api/rpc/<plugin>/...`)

| Plugin | Route(s) | Auth | Ownership / admin | Notes |
|---|---|---|---|---|
| proposals | propose | AoK | resubmission limited to the original submitter, the builder themself, admins, or core-checked editors (H-2) | private plugins need the core marker |
| proposals | approve, reject, dismissFailure, reopen, remove, markApplied/ApplyFailed/Removed/RemoveFailed | Adm | admin | |
| proposals | withdraw | Auth | creator or subject | |
| proposals | getProposals, getProposalCount, getAuditLog, subscribe | Pub | `canReadProposal` | `subscribe` streams raw error text (M-3) |
| proposals | getSubmissions, getReviewHistory, getEvaluations | Adm or Core | | |
| proposals | getMySubmission | Auth | caller | |
| proposals | recordEvaluation, acquireReviewLease, getProposalById, Telegram reviewer routes | Core | evaluator symbol | |
| projects | createProject | Auth + NEAR | owner from context; org attribution; private unless core allows public; existing id only for its owner | H-1 |
| projects | updateProject, linkAppToProject, unlinkAppFromProject | Auth | `canEditProject` | |
| projects | deleteProject | Auth | owner or admin | |
| projects | applyReviewedProject | Adm | admin | M-1 |
| projects | collaborator routes | Auth | owner / invitee | |
| projects | list/get/mentions/apps | Pub | visibility rules | `listProjectApps` has no visibility check (Low) |
| builders | createTelegramNomination, createXNomination, claimTelegramNomination | Key (bot) | admin-owned key or `nominations:write` | H-3 |
| builders | resolveTelegramNomination, resolveNomination | Pub | valid token | |
| builders | finalizeTelegramNomination, finalizeNomination | Auth + NEAR | token | M-5 |
| builders | listXNominationQueue, updateXNomination, getXNominationMetrics, createBuilder, deleteBuilder | Adm | admin | |
| builders | listBuilders, getBuilder, getBuildersByUserIds | Pub | withdrawn hidden | |
| builders | getMyBuilderProfile, withdraw/restore, updateBuilderProfile | Auth | own profile | |
| votes | upvote, downvote, getUserVote(s) | Auth | caller | |
| votes | getUpvoteCount(s), getUpvoteFeed, subscribe | Pub | – | L-4 |
| bookmarks | bookmark, unbookmark, getUserBookmark | Auth | caller | L-7 |
| activity | startActivityRegistration | Core | only via core `registerProjectActivity`, which checks owner, status and approval | H-1 |
| activity | emitActivity | Auth + NEAR | actor from context | M-2, L-2 |
| activity | emitTrustedActivity, hideActivity, gateway admin routes, importActivityHistory | Adm | admin | M-2 |
| activity | getActivityFeed, subscribeActivity, getLeaderboard, project activity reads | Pub | – | |
| events | createEvent, updateEvent | Auth (+ NEAR to create) | owner; private unless admin or core allows public; existing id only for its owner | H-1 |
| events | deleteEvent, joinEvent, leaveEvent | Auth | owner / self | |
| events | applyReviewedEvent | Adm | admin | |
| events | listEvents, getEvent, getEventBySlug, listEventParticipants, Luma reads | Pub | visibility rules | I-1 |
| apps | relayRegistryMetadataWrite, kvRelayWrite | Auth + NEAR | sender = caller | M-6 |
| apps | registry reads, kvGet, kvList, prepare routes | Pub | – | pure reads or tx builders |
| nearcatalog | search, categories, project, claims reads | Pub | – | L-6 |
| nearcatalog | claim history/apply/activity/revoke | Adm | admin | |
| credits | getCreditStatus, claimCredits | Auth | caller; eligibility checked server-side; one claim per account | |
| credits | listCreditClaims, revokeCreditClaim, settings, NEAR AI session routes | Adm | admin | L-1 |
| notifications | createNotification | Auth | self, admin, or core marker | L-2 |
| notifications | getMyNotifications, markAsRead, markAllAsRead, subscribeNotifications | Auth | caller | |

## Acceptance check against #321

- [x] Per-route auth posture for every core and plugin route (tables above).
- [x] Findings triaged by severity, with fix tickets proposed (not filed; see the list).
- [ ] Zero unprotected write endpoints. No write route is unauthenticated. H-1 to H-3 are fixed (#340, #343, #344); the remaining authorization gaps are M-1 and M-5.
- [ ] Error responses free of internals. M-3 and L-1 remain. Zod validation is present on every route, with the size gaps in L-2.
