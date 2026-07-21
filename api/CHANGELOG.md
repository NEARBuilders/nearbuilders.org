# api

## 2.6.0

### Minor Changes

- 770d16e: Add activity plugin with a public activity ledger and leaderboard (#31).

  - **activity plugin**: New generic activity store following the every-plugin scaffold — oRPC contract (`emitActivity`, `getActivityFeed`, `subscribeActivity`, `getLeaderboard`), an Effect-TS service backed by a Drizzle PostgreSQL schema (`activity_events`), and a `MemoryPublisher` for SSE streaming. Events are entity-agnostic so any source (manual uploads, NearCatalog claims, future NEARN/GitHub/IronClaw) can push them in. The leaderboard aggregates per-actor `eventCount` and `endorsementScore` (verified × 2, otherwise × 1) across `week`/`month`/`all-time` periods, sorted descending.
  - **api**: Passthrough for the activity routes — `emitActivity` (requireAuth, the only write path), `getActivityFeed` (public, pagination + filter by source/type/actor), `subscribeActivity` (public SSE with filter forwarding), and `getLeaderboard` (public, period-based ranking). SSE `signal`/`lastEventId` are forwarded so reconnects resume cleanly.
  - **infra**: New `postgres-activity` container and `ACTIVITY_DATABASE_URL` env var; existing plugin postgres ports shifted to avoid collisions.

- 142958d: Add edit builder profile (#11).

  - **api**: Expose an `updateBuilderProfile` route on the API shell that proxies to the builders plugin, which enforces owner-or-admin permissions. Builds on the existing plugin contract and service.
  - **ui**: Add a `/builders/{account}/edit` route where the profile owner (or an admin) can update their display name, bio, skills, and location with TanStack Form validation and error handling. An "Edit profile" entry point now appears on the builder profile for the owner/admin. Profile and background images continue to come from NEAR Social and are out of scope.

- Add events plugin with full CRUD, participant management, and Luma import (#24).

  - **events plugin**: Full events plugin providing create, read, update, delete, and participant join/leave flows backed by a PostgreSQL schema. Supports event visibility levels and status tracking.
  - **api**: Expose events endpoints — list, create, get, update, delete, join/leave participants, list participants, and fetch event metadata from external Luma URLs.
  - **ui**: Public events pages at `/events` with listing, detail, creation, and editing views. Admin dashboard now supports events proposals alongside builders and projects.
  - **infra**: New `postgres-events` container, `EVENTS_DATABASE_URL` env var, and port renumbering for the existing plugin databases.

- e94dd22: Fix project creation attribution and rework the project proposal flow (#7).

  - **api**: Add a `createProject` route so projects are always created directly, owned by the logged-in user's NEAR account. Non-admins cannot create public projects directly (public visibility is clamped to private) and must have a linked NEAR account. The proposal approve callback now updates the existing project's visibility instead of recreating it, so the approving admin is never recorded as the creator; proposals for projects that don't exist yet (e.g. API-key sources) are still created and attributed to the original proposer.
  - **projects plugin**: Non-admins can no longer flip a project to public via `updateProject`; making a project public requires admin approval through a proposal.
  - **ui**: Creating a project now creates it immediately (private first) and, when public visibility is requested, submits a proposal to make it public. The edit page routes public-visibility changes through the same proposal flow. Owner attribution no longer falls back to the opaque auth user id.
  - **proposals plugin**: Re-proposing an already approved/applied proposal resets it to pending instead of erroring, so a project that went public and was later made private can be submitted for review again. Prior decisions remain in the submissions history and audit log.
  - **api**: Project proposal owners must be valid NEAR account ids — opaque auth user ids and API key ids are rejected. Removing an applied project proposal now reverts the project to private instead of deleting it.

- 22f3232: Integrate Luma calendar subscriptions to display external events alongside internal NEAR Builders events (#77).

  - **events plugin**: New `LumaService` with calendar key configuration (comma-separated `LUMA_CALENDAR_API_KEYS`), calendar metadata fetching, paginated event aggregation with cursor-based navigation across multiple calendars, in-memory caching with TTL and concurrent request deduplication, and admin visibility for private events.
  - **api**: New `listLumaCalendars`, `listLumaEvents`, and `getLumaEvent` endpoints. Luma endpoints receive user context for admin role detection.
  - **ui**: Luma events display alongside internal events on `/events` with calendar source filtering dropdown, URL-based deduplication across sources, Luma event detail pages at `/events/luma/$calendarId/$eventId`, and a re-usable `EventDetail` component shared between internal and Luma event views.

- c801c40: Complete the reviewed NEAR Catalog claim lifecycle and public presentation for issues #54 and #55.

  - Derive manual activity identity from authentication, add trusted admin-only activity emission, make emitted events idempotent, and support hiding revoked activity from feeds and leaderboards.
  - Apply approved Catalog claims through a compensating workflow that verifies current builder and Catalog state, records a verified activity snapshot, and safely retries or rolls back partial failures.
  - Support rejected and removed claim resubmissions while preserving proposal history, and expose complete claim review, retry, rejection, and revocation controls to administrators.
  - Present claimed Catalog contributions on builder profiles, render specialized claim activity, and merge current Catalog projects into the public and personal project directories without duplicating local projects.

- c801c40: Add the approved-builder NEAR Catalog contribution proposal flow.

  - Keep Catalog proposals private to their submitter and administrators across proposal lists, counts, audit logs, and event streams.
  - Add authenticated Catalog claim proposal submission and current-builder status APIs with server-derived claimant identity, active-project validation, normalized roles, idempotent retries, and rejected-only revisions.
  - Resolve linked NEAR identity from the auth context so notification reads and streams remain authenticated.
  - Accept array-shaped Catalog tags and isolate malformed search entries without converting valid empty results into upstream errors.
  - Add URL-backed manual activity and project contribution tabs with Project contribution as the approved-builder default, Catalog project search and preview, multi-role submission, proposal status cards, rejected-proposal editing, and an owner-only builder profile CTA.

- c801c40: Add the NEAR Catalog project adapter and reviewed contribution claim foundation (#52).

  - **nearcatalog plugin**: Normalize active projects from the NEAR Catalog API, persist one active claim per builder and project with multiple roles, and expose public reads plus admin-only claim lifecycle operations.
  - **api**: Expose public project search, project detail, claim listing, and claimed-project aggregation routes backed by the NEAR Catalog plugin.

- 164ae1c: Add notifications plugin with approval alerts and real-time delivery (#30).

  - **notifications plugin**: New generic notification store following the every-plugin scaffold — oRPC contract (`createNotification`, `getMyNotifications`, `markAsRead`, `markAllAsRead`, `subscribeNotifications`), an Effect-TS service backed by a Drizzle PostgreSQL schema, and a `MemoryPublisher` for SSE streaming. All read/write routes are user-scoped.
  - **api**: Passthrough for the user-facing notification routes (all `requireAuth`), scoped to the caller's NEAR account. The `approve` handler emits a best-effort notification to `proposal.createdBy` after a successful apply — `project_approved`, `event_approved`, or `builder_approved` with a deep link to the new resource. SSE `signal`/`lastEventId` are forwarded so reconnects resume cleanly.
  - **ui**: Bell icon in the header (left of the avatar on desktop, left of the menu button on mobile) with a live unread badge, a dropdown of recent notifications with per-item "mark as read", and a full `/notifications` page with infinite scroll, optimistic mark-read / mark-all-read, loading/empty/error states, and SSE-driven live updates. Read state is persisted via the TanStack Query cache.
  - **infra**: New `postgres-notifications` container and `NOTIFICATIONS_DATABASE_URL` env var.

- 06966e9: Add reusable proposals and votes plugins, move API to orchestration, and shift builder/project review flows onto proposal-backed admin moderation.

### Patch Changes

- 1c028d1: Add error logging and database connection verification for better observability.

  - **api**: Wrap project handler calls (`listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, etc.) in try/catch blocks with `console.error` logging for improved debuggability.
  - **projects plugin**: Verify database connectivity on startup by issuing `SELECT 1` before running migrations; add `console.error` logging to all Effect exit failures for easier debugging of production issues.

- 974cf46: Fix proposal attribution: store NEAR wallet address as `createdBy` instead of opaque user ID, and fix project ownership when proposals are approved by admins.

  - **proposals plugin**: Prefer `walletAddress` for `actorId` so `createdBy` stores the nominator's NEAR account (e.g. `alice.near`), making "Nominated by" display as a linkable identity on the builders page.
  - **api**: Use `proposal.createdBy` as fallback for `ownerId` in the projects create callback, so approved projects are attributed to the original proposer instead of the approving admin.
  - **ui**: Always include `defaultOwnerId` in project proposal payloads so non-admin proposals carry the proposer's identity even when the ownerId field is hidden from the form.

- 31e7fe3: Reject implicit accounts in builder nominations (#8).

  - **api**: The `propose` route now validates the target account when nominating a builder. The entity ID must be a valid NEAR account ID (via `near-kit`'s `AccountIdSchema`), and implicit accounts (64-char hex, `0x`/`0s` EVM-style addresses) are rejected with a `BAD_REQUEST` error, since builder nominations require a named NEAR account.

- 1c028d1: Fix PR review issues from #27: slug API paths, kind validation, filter preservation, and event error handling.

  - **api**: Change slug lookup paths from `/v1/{resource}/slug/{slug}` to `/v1/{resource}/by-slug/{slug}` for both projects and events.
  - **events plugin**: Remove redundant SELECT-before-INSERT duplicate slug check (DB unique constraint + catch handler suffice).
  - **projects plugin**: Re-add `isProjectKind` validation in `beforeLoad` on project detail and edit routes to redirect invalid kinds to `/projects`.
  - **projects plugin**: Restore `kind` search param in navigation links so the kind filter is preserved when moving between list, detail, and edit views.
  - **ui**: Change `reviewFailed` toast on event creation to include actionable guidance ("Edit to resubmit.").
  - **fix**: Correct `vitest` catalog reference from `"^catalog:"` to `"catalog:"`.

## 2.5.0

### Minor Changes

- b662086: Replace manual EventSource SSE with oRPC MemoryPublisher + eventIterator. Eliminates MaxListenersExceededWarning from Node EventTarget, stabilizes query keys to prevent refetch cascades, and adds typed streaming via VoteEventSchema contract.
