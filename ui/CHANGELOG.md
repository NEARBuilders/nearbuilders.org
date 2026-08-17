# ui

## 1.7.0

### Minor Changes

- 8606f32: Add Discord as a builder profile social link. It's stored as a numeric Discord user ID and links to `https://discord.com/users/USER_ID`, since usernames aren't stable enough to link to directly.

## 1.6.1

### Patch Changes

- 9235213: Replace the unreplaced build-template `| app` suffix on the `/projects` and `/about` page titles with `| NEAR Builders` to match the convention used by `/events`, `/activity`, and `/builders` (#121).
- 380b52d: Fix "Pending review" using the same color as approved states, which made testers think a submission had already been approved. Pending states now use the brand-cobalt (blue) token instead of brand-cyan, which shares its hex value with brand-green.

## 1.6.0

### Minor Changes

- 13d6175: Add a public `/activity` page with a live feed (#23).

  - **Activity feed**: New browse page at `/activity` rendering activity-ledger events as cards — source/type/verified badges, actor via the NEAR profile badge, payload preview (title, description, media thumbnail, tags), and a relative timestamp. Filter by source (All/Manual/NearCatalog) and type (All/Upload/Claim), and sort by Recent or Most Endorsed.
  - **Endorsements**: Up/down vote arrows on each card endorse events through the existing votes plugin (the activity event id is the vote `entityId`), with endorsement counts batched via `getUpvoteCounts` and optimistic updates.
  - **Live updates**: SSE subscriptions stream new activity events (prepended to the feed) and endorsement-count changes in real time.
  - **Navigation**: "Activity" added to the main nav (desktop + mobile) alongside Builders/Projects/Events.
  - **Query layer**: New `ui/src/lib/queries/activity.ts` with `activityFeedQueryOptions` (infinite), `leaderboardQueryOptions`, `emitActivityMutationOptions` (with cache invalidation), and an `ActivityEvent` type.

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

- 164ae1c: Add notifications plugin with approval alerts and real-time delivery (#30).

  - **notifications plugin**: New generic notification store following the every-plugin scaffold — oRPC contract (`createNotification`, `getMyNotifications`, `markAsRead`, `markAllAsRead`, `subscribeNotifications`), an Effect-TS service backed by a Drizzle PostgreSQL schema, and a `MemoryPublisher` for SSE streaming. All read/write routes are user-scoped.
  - **api**: Passthrough for the user-facing notification routes (all `requireAuth`), scoped to the caller's NEAR account. The `approve` handler emits a best-effort notification to `proposal.createdBy` after a successful apply — `project_approved`, `event_approved`, or `builder_approved` with a deep link to the new resource. SSE `signal`/`lastEventId` are forwarded so reconnects resume cleanly.
  - **ui**: Bell icon in the header (left of the avatar on desktop, left of the menu button on mobile) with a live unread badge, a dropdown of recent notifications with per-item "mark as read", and a full `/notifications` page with infinite scroll, optimistic mark-read / mark-all-read, loading/empty/error states, and SSE-driven live updates. Read state is persisted via the TanStack Query cache.
  - **infra**: New `postgres-notifications` container and `NOTIFICATIONS_DATABASE_URL` env var.

- 6ec106d: Add a private `/profile/activity` page (#34).

  - Auth-gated page where a builder views their own activity feed (filtered by their NEAR account) and manually submits contributions.
  - Submission form (TanStack Form): title, description, media URL, and comma-separated tags with a live badge preview; emits an activity event with `source: "manual"`, `type: "upload"`, `verified: false`. Success/error toasts, and the feed refetches on submit.
  - Extracts the activity feed into a shared `ActivityFeed` component (and a presentational `ActivityCard`) reused by both the public `/activity` page and this private page, so the feed/endorsement/SSE logic lives in one place.

- Move projects to public layout with sort, badge, and metadata (#25).

  - **ui**: Project pages (`/projects`) are now publicly viewable instead of locked behind the authenticated dashboard. Project creation and editing routes add `beforeLoad` auth redirects.
  - **ui**: New `NewBadge` component highlights projects created in the last 7 days on both the list and detail views.
  - **ui**: Project list gains a sort dropdown (most votes, newest, oldest) with URL search param persistence.
  - **ui**: Project detail pages emit Open Graph meta tags (title, description, social image) for link previews.

- 4484095: Add a project proposal preview modal to the admin dashboard.

  - Admins can open full project proposal details from pending project review cards before approving or rejecting.
  - Project proposals render description, visibility, repository link, and markdown content in a scrollable dialog.
  - Repository README content is fetched and shown for project submissions when available, giving reviewers a closer preview of the submitted project page.

- 1a2f1d5: Fix stale vote counts and add social preview metadata to detail pages.

  - **ui**: Fix a query-key mismatch on the projects list page (`projectIds` vs `projectIdList`) that left upvote/downvote counts stale until a full page reload. The vote mutations and the live-vote subscription now write to the same cache key the on-screen counts read from. Also fixes the project detail page's `userVoteState` cache to store the shape its query actually reads instead of a bare string.
  - **ui**: Add `siteUrl` to Open Graph/social preview metadata on builder profile, event, and project detail pages via a shared `getSiteUrl` helper, so shared links on these pages render proper previews and canonical URLs.

- 974cf46: Merge builder nominations into the builders list: nominated builders now appear inline alongside approved builders with auto-reordering by vote count, dashed borders for nominated-only entries, a unified row-style card layout, and animated upvote/pop interactions. Builder profile pages now show nomination status and history with fallback views for unapproved builders.
- 06966e9: Add reusable proposals and votes plugins, move API to orchestration, and shift builder/project review flows onto proposal-backed admin moderation.

### Patch Changes

- 1c028d1: Swap suspense queries for regular queries with loading/error fallback on builders page.

  - **ui**: Replace `useSuspenseInfiniteQuery`/`useSuspenseQuery` with `useInfiniteQuery`/`useQuery` on the builders list page, adding a loading spinner and a graceful error state ("Unable to load builders") instead of relying on suspense boundaries.

- 974cf46: Fix proposal attribution: store NEAR wallet address as `createdBy` instead of opaque user ID, and fix project ownership when proposals are approved by admins.

  - **proposals plugin**: Prefer `walletAddress` for `actorId` so `createdBy` stores the nominator's NEAR account (e.g. `alice.near`), making "Nominated by" display as a linkable identity on the builders page.
  - **api**: Use `proposal.createdBy` as fallback for `ownerId` in the projects create callback, so approved projects are attributed to the original proposer instead of the approving admin.
  - **ui**: Always include `defaultOwnerId` in project proposal payloads so non-admin proposals carry the proposer's identity even when the ownerId field is hidden from the form.

- 766736f: Refine the notifications menu layout, responsive sizing, unread hierarchy, and action alignment.
- 1c028d1: Fix PR review issues from #27: slug API paths, kind validation, filter preservation, and event error handling.

  - **api**: Change slug lookup paths from `/v1/{resource}/slug/{slug}` to `/v1/{resource}/by-slug/{slug}` for both projects and events.
  - **events plugin**: Remove redundant SELECT-before-INSERT duplicate slug check (DB unique constraint + catch handler suffice).
  - **projects plugin**: Re-add `isProjectKind` validation in `beforeLoad` on project detail and edit routes to redirect invalid kinds to `/projects`.
  - **projects plugin**: Restore `kind` search param in navigation links so the kind filter is preserved when moving between list, detail, and edit views.
  - **ui**: Change `reviewFailed` toast on event creation to include actionable guidance ("Edit to resubmit.").
  - **fix**: Correct `vitest` catalog reference from `"^catalog:"` to `"catalog:"`.

## 1.5.1

### Patch Changes

- dd5a7d4: Fix production SSR by keeping the UI auth client local during server rendering and by resolving SSR-imported asset URLs from the UI remote instead of the host origin.

## 1.5.0

### Minor Changes

- b662086: Replace manual EventSource SSE with oRPC MemoryPublisher + eventIterator. Eliminates MaxListenersExceededWarning from Node EventTarget, stabilizes query keys to prevent refetch cascades, and adds typed streaming via VoteEventSchema contract.

### Patch Changes

- b662086: Move the homepage BOS viewer into an isolated iframe surface backed by a host-rendered `/_viewer` page.

  - Update `ui/src/routes/_layout/index.tsx` to load the landing viewer through `/_viewer` while preserving `?path=` support.
  - Add a dedicated host-rendered `/_viewer` endpoint with scoped CSP framing rules so the viewer can run in production without weakening the rest of the app.
  - Bootstrap the NEAR BOS web component from the host page so the requested widget path is forwarded correctly into the viewer runtime.

- b662086: Fix sidebar navigation to derive from plugin sidebar items and include projects

  - Updated `ui/src/routes/_layout.tsx` to properly consume generated `pluginSidebarItems` instead of using hardcoded navigation.
  - Fixed `packages/everything-dev/src/sidebar.ts` so the core `home` item points to `/home` (logo/dot still links to `/` for repository markdown render).
  - Added `plugins.projects.sidebar` to `bos.config.json` so the projects plugin appears in generated navigation.
  - Regenerated `ui/src/lib/plugin-sidebar.gen.ts` via `bos types gen` to include the `projects` sidebar item.
  - Fixed unbalanced JSX structure in `_layout.tsx` and removed stale/unused imports.

- b662086: Add a public skill surface for agents and builders, including a rendered `/skill` page, an updated raw `/skill.md` prompt, links from the about page, and a floating home-screen assistant that opens quick actions for the skill and related docs.
- b662086: Refactor the shared app shell by extracting the existing `_layout` chrome into `ui/src/components/style-chrome.tsx` without changing the intended authenticated and unauthenticated UI behavior.

## 1.5.3

### Patch Changes

- 0e72704: Add notFoundComponent and errorComponent to root route, use shared sessionQueryKey constant, and improve OG image alt text.

## 1.5.2

### Patch Changes

- ef4a77b: Tighten the host CSP in production by switching to nonce-based script loading with `strict-dynamic` while keeping `unsafe-eval` for Module Federation. Also pass the host-provided CSP nonce into the NEAR auth client so wallet iframe scripts continue to run under the stricter policy.

## 1.5.1

### Patch Changes

- 212ea6f: Clean up test infrastructure: proxy mock, dead env plumbing, and type cast

  - **host/tests**: Replace 80-line manual `AuthClient` mock with an 8-line
    `Proxy`-based mock that auto-implements any property, making it resilient
    to auth client API changes.
  - **host/tests**: Remove dead `vitest.setup.ts` and its `setupFiles` entry
    from `vitest.config.ts`. The `BOS_UI_URL`/`BOS_UI_SSR_URL` env var
    plumbing was unused after switching `loadTestRuntimeConfig` to read
    production URLs from `bos.config.json`. Simplify `global-setup.ts` to
    just build the UI dist (no HTTP server or env var setup needed).
  - **ui**: Remove unnecessary type cast in `renderToStream` —
    `renderOptions.authClient` is now typed directly via `RenderOptions`.
    Remove unused `AuthClient` type import.

- 521f85e: Fix SSR auth client injection, proxy test mock shape, and test config resolution

  - **host**: Pass `authClient` to SSR `renderToStream` so the host's pre-resolved auth client
    is reused instead of creating a new one from config. Export `toAuthClientContext` for use
    in program.ts. Proxy test mock updated to use correct `initialized.context` shape instead
    of putting handler directly on `initialized`.

  - **everything-dev**: Add optional `authClient` field to `RenderOptionsWithApi` type so
    callers can provide a pre-configured auth client for SSR rendering.

  - **ui**: `renderToStream` now uses `authClient` from render options when provided, falling
    back to `createAuthClient(runtimeConfig)` when not specified.

  - **host/tests**: Replace `process.env`-based `BOS_UI_URL`/`BOS_UI_SSR_URL` with production
    URL fallbacks from `bos.config.json` (`app.ui.production`, `app.ui.ssr`). Add
    `createMockAuthClient` helper returning a null-session auth client for SSR tests. Pass
    `session: null` and `authClient` in test render options to match production SSR semantics.

## 1.5.0

### Minor Changes

- 81f2599: Add `title` and `description` fields to `bos.config.json`, runtime config, and `ClientRuntimeInfo`. SEO head metadata now reads `title`/`description` from `runtimeConfig.runtime` instead of hardcoded defaults. Also removes a debug console.log, fixes an outdated comment in app.ts, adds a Dockerfile comment, and adds a workflow comment for FCAK creation.

## 1.4.9

### Patch Changes

- ffa8200: Catalog-ify rspack/rsbuild packages and propagate via bos upgrade/sync

  - Add @rspack/core, @rspack/cli, @rsbuild/core, @rsbuild/plugin-react to root package.json catalog
  - Convert all workspace package.json rspack/rsbuild deps from version ranges to catalog: refs
  - Change every-plugin @rspack/core peerDep from exact 1.7.4 to range ^1.7.4
  - Add CATALOG_TOOL_PACKAGES to manifest-normalizer for catalog: conversion during init/sync
  - Extend bos upgrade to also bump catalog tool packages to latest npm versions
  - Extend bos status to report catalog tool package versions

## 1.4.8

### Patch Changes

- 6425196: Upgrade hono to >=4.12.18 to resolve 5 security vulnerabilities (CSS injection, JWT validation, cache leakage, XSS, bodyLimit bypass). Soften CI audit step to warn instead of fail on high/critical findings for build-time-only dependencies.
- 519ded7: Fix sidebar active state: use TanStack Router `useLocation()` for reactivity and segment-boundary matching to prevent false positives

## 1.4.7

### Patch Changes

- 09a1405: Restore the UI app barrel helpers used by route code so the build keeps working with runtime-config-driven pages.

## 1.4.6

### Patch Changes

- 21836cb: Remove legacy UI generator plumbing and tighten the scaffold surface so fresh projects and upgrades do not ship references to missing files.

## 1.4.5

### Patch Changes

- 482cca9: Expand shared UI auth dependency policy so downstream apps inherit singleton better-auth, better-near-auth, and Better Auth client addons through template sync. Declare the UI's direct Better Auth addon dependencies explicitly to avoid duplicate installs and nominal type mismatches.

## 1.4.4

### Patch Changes

- 9b69858: Expand the shared auth dependency policy so downstream apps inherit singleton `better-auth`, `better-near-auth`, and Better Auth client addons through template sync. Also declare the UI's direct Better Auth addon dependencies explicitly to avoid duplicate installs and nominal type mismatches.

## 1.4.3

### Patch Changes

- e2a3d4a: Move theme toggle to fixed bottom-left position when not authenticated, keeping it always visible independent of page content.

## 1.4.2

### Patch Changes

- f64f1a8: Fix theme toggle positioning: sticky sidebar on desktop with internal scrolling, add toggle to mobile bottom nav, and make it visible on desktop header when not authenticated.

## 1.4.1

### Patch Changes

- cd7692f: Strengthen the generated auth surface and remove duplicate client facades so downstream packages rely on the canonical typed auth client.

## 1.4.0

### Minor Changes

- b06192b: Consolidate auth-client and session into single auth.ts with router context singleton pattern. Add useAuthClient() hook, remove runtimeConfig prop threading from components, upgrade better-near-auth to 1.4.0.

### Patch Changes

- 05c9fe2: Fix changeset CI errors: replace catalog: protocol for every-plugin dependency so changesets can resolve versions

## 1.3.4

### Patch Changes

- d920486: Export `Auth` type from generated auth-types.gen.ts for inferAdditionalFields

  The `auth-types.gen.ts` file now re-exports `Auth` from better-auth so
  the UI can use `inferAdditionalFields<Auth>()` instead of
  `inferAdditionalFields<typeof createAuthInstance>()`.

## 1.3.3

### Patch Changes

- 76c152b: Fix SSR runtime config errors by passing runtimeConfig to all auth clients

  `getAuthClient()` and `sessionQueryOptions()` were being called without `runtimeConfig` during server-side rendering, which caused `getRuntimeConfig()` to throw "Runtime config is only available in the browser". This propagated as repeated SSR 500 errors across all routes.

  Updated all route components and `UserNav` to read `runtimeConfig` from `Route.useRouteContext()` and pass it explicitly to `getAuthClient(runtimeConfig)` and `sessionQueryOptions(undefined, runtimeConfig)`. Also updated the `_layout.tsx` `beforeLoad` and `login.tsx` `beforeLoad`/`loader` to pass `context.runtimeConfig` into `sessionQueryOptions`.

  Files changed: `_layout.tsx`, `login.tsx`, `$gatewayId.tsx`, `home.tsx`, `settings.tsx`, `organizations/$id.tsx`, `organizations/index.tsx`, `organizations/new.tsx`, `projects/index.tsx`, `projects/$id.tsx`, and `user-nav.tsx`.

## 1.3.2

### Patch Changes

- 2c58902: Remove stale `auth-client.gen.ts` and fix UI implicit-any TypeScript errors.

  - **everything-dev**: Removed `api/src/auth-client.gen.ts` from the `typesGen` generated file list in `plugin.ts`. This file was consolidated into `plugins-client.gen.ts` in a previous release but the metadata still referenced it, causing confusion when the stale file was left in workspaces.

  - **ui**: Added explicit type annotations to callback parameters in:
    - `src/routes/_layout/login.tsx`: `onError` callbacks for NEAR sign-in, passkey, anonymous, email, phone OTP, and GitHub social login.
    - `src/routes/_layout/apps/$accountId/$gatewayId.tsx`: `TransactionBuilder` parameter in two `buildSignedDelegateAction` calls.

  These fixes resolve `noImplicitAny` errors under `strict` mode without changing runtime behavior.

## 1.3.1

### Patch Changes

- b1adcb2: Fix SSR crash: pass runtimeConfig from router context to auth client instead of reading window.**RUNTIME_CONFIG** during server-side route matching

## 1.3.0

### Minor Changes

- c5fecc9: Switch from PGlite to Docker Postgres for development, fix multi-instance WASM crash, add auto-migration and infinite scroll for projects

  The host was crashing with `RuntimeError: Aborted()` because multiple PGlite WASM instances cannot coexist in a single Node.js process. This replaces in-process PGlite with Docker Postgres for development, and adds several related fixes:

  - Add `docker-compose.yml` with 3 postgres:17-alpine services (api:5432, auth:5433, projects:5434)
  - Add `dev:postgres`, `dev:postgres:down`, `dev:postgres:reset` convenience scripts
  - Declare `API_DATABASE_URL` and `PROJECTS_DATABASE_URL` secrets in `bos.config.json` so the host injects them into plugins
  - Conditionally disable SSL for localhost connections in `createDatabaseDriver` (3 files)
  - Add auto-migration to API and projects plugins on startup (matching auth plugin's existing pattern)
  - Fix projects `listProjects` pagination: move visibility filter from JS post-filter to SQL WHERE clause, add offset-based cursor pagination
  - Add infinite scroll with IntersectionObserver to projects list UI
  - Default project visibility to `public` instead of `private`
  - Show all visible projects (public/unlisted from everyone + own private) instead of filtering to current user only
  - Fix CI: replace broken `file:./api-test.db` with postgres service container

- f3f9e64: Migrate projects and API plugins to PostgreSQL with pglite fallback, add generic upvote system with SSE live ranking, and redesign projects page as a real-time ranked leaderboard.

  ### What Changed

  **API Plugin**

  - Migrated from SQLite to PostgreSQL (`pg` production, `pglite` local fallback)
  - Added `upvotes` table with unique constraint on `(thing_id, user_id)`
  - New upvote endpoints: `upvoteThing`, `downvoteThing`, `getUpvoteCount`, `getUpvoteFeed`
  - Real-time SSE stream at `/api/upvotes/stream` with in-memory pub/sub
  - Unified database defaults to `pglite:.bos/<plugin>/:memory:`

  **Projects Plugin**

  - Migrated from SQLite/libsql to PostgreSQL (same driver pattern as auth)
  - Dropped KV store (`kvStore` table, `KvService`, and all KV routes)
  - Regenerated Drizzle schema with `pgTable` and `timestamp with time zone`
  - Unified database defaults to `pglite:.bos/projects/:memory:`

  **Auth Plugin**

  - Updated default `AUTH_DATABASE_URL` to `pglite:.bos/auth/:memory:`
  - Driver now detects `:memory:` basename for true in-memory mode

  **UI**

  - Complete redesign of projects list page
  - Full-width horizontal cards with rank numbers (`#1`, `#2`, etc.)
  - Vote stack on right (↑ count ↓)
  - Projects sorted by upvote count descending
  - Framer Motion `Reorder.Group` for smooth rank transitions
  - SSE integration pushes live vote updates that trigger re-sorting
  - Removed legacy `keys/` KV test routes and UI

  **Config**

  - Updated `.env.example` with new PostgreSQL default comments
  - Removed `keys/**` from `bos.config.json` projects plugin routes

- 89c20cb: Remove opencode plugin and related UI routes

  ### What Changed

  - **Deleted** `plugins/opencode/` — the opencode plugin is no longer part of the project
  - **Deleted** `ui/src/routes/_layout/opencode.tsx` — removed the `/opencode` route page
  - **Updated** `ui/src/routes/_layout/_authenticated/_admin/dashboard.tsx` — replaced opencode-specific server/prompt tabs with a simple admin placeholder
  - **Updated** `ui/src/routes/_layout/about.tsx` — removed the `/opencode` link
  - **Updated** `ui/public/llms.txt` and `ui/public/skill.md` — removed `/opencode` from public paths
  - **Updated** `AGENTS.md` and `CONTRIBUTING.md` — removed opencode plugin references
  - **Updated** `bos.config.json` — removed the `opencode` plugin entry

### Patch Changes

- 033f41f: Add projects link to sidebar and mobile nav, fix missing useQuery import

## 1.2.1

### Patch Changes

- e53af6e: Add CSP with feature flag, integrity registry, on-chain attestation, and safe plugin client factory

  CSP: Add `CSP_STRICT` const (default false) that toggles between relaxed mode (`'unsafe-inline'` + `'unsafe-eval'`) and strict mode (nonce + `'strict-dynamic'`). Relaxed mode is the default because Module Federation requires `'unsafe-eval'`, making strict inline script enforcement moot. All other CSP directives (object-src, base-uri, frame-ancestors, connect-src, etc.) remain enforced regardless of mode. When strict mode is enabled, nonces are injected into HTML script tags and the runtime config.

  Integrity: Add `IntegrityRegistry` class for SRI hash tracking, `installIntegrityFetchHook` for MF lifecycle fetch interception, `verifyConfigAgainstChain` for on-chain attestation checks, and `startIntegrityMonitor` for periodic background re-verification.

  Safety: Wrap plugin client factories with `createSafeClientFactory` to prevent arbitrary context injection. Merge CSP headers into SSR responses.

- 0a67206: Refactor dev orchestrator to service-descriptor architecture; add NEAR auth contract routes (nonce, verify, profile, relay, view); consolidate session queries in UI; add source-map devtool for plugin builds
- 34207e4: Reorganize dev port assignments: host=3000, api=3001, auth=3002, ui=3003, ui-ssr=3004, plugins=3010+

  Fix dev TUI display: host always shows "running" with port, remote non-host services show "loaded" without port. Strip ANSI codes from log files, only tag stderr as [ERR] when content is actually error-like, and replace Effect.logInfo with console.log in host logger for clean output.

## 1.2.0

### Minor Changes

- c0452e7: Renamed `productionIntegrity` to `integrity` across all schemas, build configs, and `bos.config.json`. Added `name` and `version` fields to `BosPluginRef`. Enhanced `bos plugin add` with `bos://account/plugins/name` registry resolution, manifest validation, and automatic integrity computation. Enhanced `bos plugin publish` with manifest validation, integrity computation, and FastKV plugin registry writes. Added generic KV routes (`kvGet`, `kvList`, `kvPrepareWrite`, `kvRelayWrite`) to the registry plugin.
- db3ba6b: Remove near-kit dependency from UI. Delete near-client.ts wrapper and refactor gateway page to use authClient.near (buildSignedDelegateAction, relayTransaction) directly via better-near-auth.
- c29e058: Migrate auth from plugin to app-level infrastructure. Host mounts only the raw Better Auth handler; authClient is injected separately from pluginsClient. Plugins receive auth context per-request, not via injected clients. Projects plugin cleaned of auth-proxying routes. Deleted every-plugin/context.ts.
- 6428994: Switch from npm better-near-auth v0.6.0 to local file:../../lib/better-near-auth. Replaces @fastnear/wallet and @fastnear/near-connect with @hot-labs/near-connect + near-kit, removing the "Receiving connection details…" wallet modal hang. Also fixes session race condition in login redirect and NEAR sign-in pending state timing.
- 772b71e: Remove session.ts, adopt getAuthClient() and useSession() hook

  Delete centralized session.ts (query options, helpers, action wrappers). Replace authClient proxy export with getAuthClient() function. Switch from useQuery(sessionQueryOptions()) to authClient.useSession() hook throughout. Inline query/mutation definitions in components. Refactor login page from 8 useMutation hooks to async handlers with shared isPending state.

### Patch Changes

- a483214: Fix build and test issues after switching to local better-near-auth

  - Added `@hot-labs/near-connect@0.11.2` as a root dependency and override to resolve missing prebuilt artifacts from the GitHub version
  - Fixed duplicate `"clsx"` key in `ui/package.json` that caused `bun install` warnings
  - Updated `better-near-auth` API usage in `$gatewayId.tsx` to match new `buildSignedDelegateAction(receiverId, builderFn)` signature and `relayTransaction({ payload })` shape
  - Fixed `deposit` → `attachedDeposit: 0n` to satisfy `AmountInput` type requirements
  - Removed unused `normalizePath` function in `plugins/auth/rspack.config.js`
  - Fixed `EmitPluginManifest` `srcPath` from `"types/auth-export.d.ts"` to `"auth-export.d.ts"` (plugin already prefixes `types/`)
  - Added `--root .` to `api` vitest scripts to prevent test discovery leaking into other workspace packages

- 069cb6a: Upgrade better-near-auth from local file import to published v1.0.0

  Switches the workspace catalog entry from `file:../../lib/better-near-auth` to `^1.0.0`, consuming the official npm release. The v1.0.0 package already includes the near-kit + @hot-labs/near-connect migration and the relay API shape used by the gateway page, so no source code changes are required.

  - `relayer: {}` in server config continues to use all defaults (ephemeral auto-generated keypair)
  - Client `siwnClient({ recipient, networkId })` remains valid
  - `auth.near.buildSignedDelegateAction()` and `auth.near.relayTransaction({ payload })` APIs unchanged

## 1.1.3

### Patch Changes

- d96b5d3: Enforce effect and zod as singleton shared dependencies across Module Federation runtime

  - Add `effect` and `zod` as direct dependencies in api, host, and ui packages with catalog-pinned exact versions
  - Move `every-plugin` from devDependencies to dependencies in api and ui (runtime import)
  - Add `effect` and `zod` to `bos.config.json` `shared.ui` as singleton MF shared deps to prevent duplicate runtime instances
  - Pin `effect`, `zod`, and `@orpc/*` to exact versions in workspace catalog and add overrides to eliminate version drift
  - Unify `@orpc/*` version refs across api, host, and ui to use catalog instead of mixed ranges
  - Update `every-plugin` mf-config to resolve effect/zod versions from installed packages instead of hardcoded ranges
  - Merge `overrides` field in sync flow's `mergePackageJson` to preserve user overrides during upgrade

## 1.1.2

### Patch Changes

- f199d5e: Remove stale `./types` Module Federation expose pointing to non-existent `src/types/index.ts`, fixing build error

## 1.1.1

### Patch Changes

- aeab5ce: Remove demo routes and fix plugin routing. API shell now only exposes `ping` and `authHealth` (with `requireAuth` middleware). Plugin-specific routes are registered before the base API catch-all in Hono, fixing 404s on `/api/rpc/{plugin}/*`. OpenAPI spec includes the current domain as an available server.

## 1.1.0

### Minor Changes

- 4efd2db: ## Extract business logic into plugins

  ### Breaking changes (api)

  All business routes have been removed from the `api` package. The API is now a thin structural shell with only health and error routes:

  - **Removed**: `listRegistryApps`, `getRegistryApp`, `getRegistryAppsByAccount`, `getRegistryAppByHost`, `getRegistryStatus`, `prepareRegistryMetadataWrite`, `relayRegistryMetadataWrite` (moved to `plugins/registry/`)
  - **Removed**: `listKeys`, `getValue`, `setValue`, `deleteKey` (moved to `plugins/projects/`)
  - **Removed**: `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `listProjectApps`, `linkAppToProject`, `unlinkAppFromProject`, `listProjectsForApp` (moved to `plugins/projects/`)
  - **Removed**: `listApiKeys`, `createApiKey`, `deleteApiKey` (moved to `plugins/projects/`)
  - **Removed**: `listOrgMembers`, `listOrgInvitations`, `cancelInvitation`, `resendInvitation` (moved to `plugins/projects/`)
  - **Kept**: `ping`, `authHealth`, `publicError`, `protectedError`
  - **Kept**: `requireAuth`, `requireNearAccount`, `requireOrgRole` middleware (duplicated in plugins)

  ### New: registry plugin (`@everything-dev/registry-plugin`)

  FastKV app discovery, metadata publish/relay. No database required.

  - All registry routes from the API are now under `apiClient.registry.*`
  - Configuration via `REGISTRY_RELAY_*` secrets and optional `registryNamespace` variable

  ### New: projects plugin (`@everything-dev/projects-plugin`)

  Projects CRUD, KV store, org management, API keys. SQLite via libsql.

  - All projects/KV/org/API key routes from the API are now under `apiClient.projects.*`
  - Configuration via `PROJECTS_DATABASE_URL` and `PROJECTS_DATABASE_AUTH_TOKEN` secrets

  ### UI changes

  Stale route files for organizations, keys, apps, and settings pages were removed. Project pages (detail, list, new) were later restored to work with the namespaced projects plugin client.

  All `apiClient` calls to business routes must now use namespaced access:

  - `apiClient.listRegistryApps()` → `apiClient.registry.listRegistryApps()`
  - `apiClient.getProject()` → `apiClient.projects.getProject()`
  - `apiClient.listKeys()` → `apiClient.projects.listKeys()`
  - etc.

- d4df05d: ## Infrastructure: CI optimization, Docker hardening, staging environments, config-driven architecture

  ### CI/CD improvements

  - **Consolidated lint + typecheck** into a single job (was 2 sequential), removing ~1-2 minutes per CI run
  - **Replaced `bun lint` + `bun format:check`** with single `biome ci .` command
  - **Pinned Bun version** to `"1.4"` in all workflows (was `latest`)
  - **Added native caching** via `setup-bun@v2` cache option (removed redundant `actions/cache`)
  - **Upgraded `actions/checkout`** from v6 to v4
  - **Parallelized typecheck** across packages using background processes (`& wait`)
  - **Staging deployment workflow** (`.github/workflows/staging.yml`) — builds `:staging` image on merge to main
  - **Preview deployment workflow** (`.github/workflows/preview.yml`) — builds `:pr-N` image per PR, comments preview URL
  - **CI workflows read domain from `bos.config.json`** via `jq` instead of hardcoding

  ### Docker hardening

  - **Non-root user**: Container now runs as `appuser` (UID 1001) instead of root
  - **Layer caching**: Dependencies installed before source code copy for better cache hits
  - **Bun 1.4**: Updated base image from `oven/bun:1.3.9-alpine` to `oven/bun:1.4-alpine`
  - **Added `curl` and `/health` healthcheck** with 30s interval
  - **Removed `Dockerfile.dev`**: Development flow uses `bos dev`, not a dev Docker image
  - **Added `railway.json`** for Railway deployment configuration with health checks

  ### Staging environment support

  - **Added `staging` field** to `BosConfigSchema` for staging domain configuration
  - **Added `--env` flag** to CLI start command supporting `production` and `staging` environments
  - **Updated `start` script** to accept `APP_ENV` environment variable for environment selection
  - **Staging mode** sets `GATEWAY_DOMAIN` from `config.staging.domain` and labels process as "Staging Mode"

  ### Config-driven architecture

  `bos.config.json` is now the single source of truth. All hardcoded values have been eliminated in favor of deriving from config at runtime or build time:

  - **Removed hardcoded defaults** from `package.json` start script — `--account` and `--domain` no longer have shell fallbacks; config is read from `bos.config.json`
  - **`BETTER_AUTH_URL`** now defaults to `config.hostUrl` instead of hardcoded `localhost:3000`
  - **`fastkv.ts`** mainnet fallback uses the actual `accountId` parameter instead of hardcoded `"dev.everything.near"`
  - **Host page title** uses `config.domain` instead of hardcoded `"everything.dev"`
  - **UI app name** is injected at build time from `bos.config.json` via rsbuild `source.define` (was hardcoded `"everything.dev"` in 15+ route files)
  - **UI `about.tsx`** registry query params use `activeRuntime.accountId`/`gatewayId` instead of hardcoded values

  ### Breaking changes

  - `BOS_ACCOUNT` and `GATEWAY_DOMAIN` are no longer default-encoded in Docker image — config comes from `bos.config.json`
  - Docker `CMD` no longer passes `--account` / `--domain` — use `APP_ENV` env var to switch environments
  - `BosConfigSchema` now includes optional `staging` field — existing configs are unaffected
  - `StartOptionsSchema` now includes optional `env` field — existing invocations are unaffected
  - UI `branding.ts` `APP_NAME` now reads from `import.meta.env.APP_NAME` with `"everything.dev"` fallback

- 8e378e3: Add opencode integration page, skill, and runtime config hot-swap design

  - New `/opencode` route with integration status and configuration
  - Admin dashboard updates for opencode management
  - Runtime config hot-swap design documentation

### Patch Changes

- 7e1286a: ## Security hardening: SRI integrity, CORS tightening, and config cleanup

  ### Subresource Integrity (SRI) for remote entries

  - **New `everything-dev/integrity` module** with `computeSriHash`, `computeSriHashForUrl`, and `verifySriForUrl` — single source of truth for all integrity operations
  - **Deploy hooks** now compute SHA-384 hashes of `remoteEntry.js` and write `productionIntegrity`/`ssrIntegrity` to `bos.config.json` on deploy
  - **Client-side SRI**: `<script>` tags for remote entries now include `integrity` and `crossorigin="anonymous"` attributes
  - **Server-side SRI verification** before loading SSR modules, API plugins, and UI federation remotes
  - **Integrity plumbing**: `productionIntegrity` and `ssrIntegrity` fields flow through `BosConfig` → `RuntimeConfig` → `ClientRuntimeConfig` → HTML rendering

  ### CORS hardening

  - **`host/src/services/auth.ts`**: Better Auth `trustedOrigins` now falls back to `[hostUrl, ...uiUrl]` instead of `[]` when `CORS_ORIGIN` is unset, aligning with Hono CORS middleware
  - **`host/src/program.ts`**: Production warning when `CORS_ORIGIN` is unset; fixed bug where empty `uiConfig.url` could be included as a CORS origin
  - **`packages/everything-dev/src/host.ts`**: CORS origins now include UI URL in fallback; production warning added
  - **Production warning** added for missing `BETTER_AUTH_SECRET`

  ### Config / type cleanup

  - **Removed `resolvedConfig` and `canonicalConfigUrl`** from `ClientRuntimeInfo` — these leaked arbitrary config data to the client
  - **Renamed `ActiveRuntimeInfo`** to `ClientRuntimeInfo` everywhere for consistency
  - **Deduplicated `SharedDepConfigSchema`** — now an alias for `SharedConfigSchema`
  - **Added `productionIntegrity`** to `BosConfigInput` interface, removing `as any` cast
  - **Added `testnet`** to `BosConfigSchema`

  ### Bug fixes

  - Fixed trailing slash inconsistency in host's SSR URL construction
  - Fixed SRI integrity check being inside Effect retry scope (now fails fast, only module loading is retried)
  - Added `integrity` verification to API plugin loading (`everything-dev/src/api.ts` and `host/src/services/plugins.ts`)

  ### Breaking changes

  - `ActiveRuntimeInfo` type removed — use `ClientRuntimeInfo`
  - `resolvedConfig` and `canonicalConfigUrl` removed from `ClientRuntimeInfo`
  - `BetterAuth` `trustedOrigins` default changed from `[]` to `[hostUrl, ...uiUrl]`

- 8e378e3: Restore project pages, remove stale organization/key/app pages

  - Restored projects detail, list, and new pages
  - Removed stale organization, keys, and apps route files

## 1.0.1

### Patch Changes

- d4a584d: Refactor navigation to use TanStack Router best practices

  - Replace internal navigation `<a>` tags with `<Link>` components for automatic intent-based preloading
  - Remove `as never` type casts from route definitions to restore proper TypeScript inference
  - Fix route param types for dynamic routes (organizations, projects, apps)
  - Fix optional search params type inference for `/apps` route
  - Improve type safety and autocomplete for route navigation
  - Preserve external links as `<a>` tags (API endpoint, external domains, static files)

  This enables automatic route preloading on hover/focus, improving navigation performance and user experience.

## 1.0.0

### Major Changes

- f080b87: Release v1.0.0 of the everything-dev toolchain.

  - Promote api, ui, everything-dev, and every-plugin to stable 1.0.0
  - Promote the plugin template package to stable 1.0.0

### Minor Changes

- a4327aa: Early 2000s Google-inspired theme redesign with 3D beveled components

  - Switched from Red Hat Mono to Inter font for modern sans-serif typography
  - Implemented Google-inspired color palette (light and dark mode)
  - Added 3D beveled borders (outset/inset) for classic early 2000s aesthetic
  - Refactored all UI components to use Button, Input, and Card components
  - Updated all routes to use styled components instead of inline Tailwind classes
  - Added modern hover effects and smooth transitions
  - Maintained accessibility with focus rings and keyboard navigation
  - Full dark mode support with appropriate color adjustments

- 2c93dbb: Multi-tenant organization support with Better Auth integration

  - Added Better Auth organization plugin with teams support
  - Implemented all authentication methods: NEAR, email/password, phone OTP, passkey, anonymous
  - Personal organization auto-created for every non-anonymous user
  - Organization management UI: browse, create, switch, invite members
  - Real invitation flow with email notifications
  - Dev-preview email/SMS transport (logs to .dev-preview/ directory)
  - Account settings page for managing auth methods and security
  - Removed placeholder org RPCs - now using Better Auth directly
  - Added API key plugin support
  - Updated milestone-1 documentation

- 77191cd: Add a published runtime registry with host-aware runtime resolution and explorer flows.

  - Add registry discovery, detail, metadata preparation, and relay APIs for published BOS configs
  - Resolve active runtimes in the host so published apps can run from canonical host URLs or `_runtime` overrides
  - Add UI pages for browsing published apps, inspecting runtime config, and publishing registry metadata

- 9cb973d: Abstract UI runtime into everything-dev package

  - Moved router creation, SSR rendering, and hydration into everything-dev/ui
  - Split package exports into ./ui/client (browser-safe) and ./ui/server (SSR)
  - Added networkId derivation from account suffix (testnet/mainnet)
  - Created canonical ui/src/app.ts barrel for apiClient, authClient, runtime helpers
  - Deleted ui/src/remote/\* indirection layer
  - Added API contract manifest with checksum for type sync
  - Added everything-dev types sync CLI command

- 1f8ac1a: Add user-owned projects for organizing NEAR apps

  - Add projects database schema with projects and project_apps tables
  - Add ProjectService with Effect pattern for proper dependency injection
  - Add 8 project API endpoints: list, get, create, update, delete, list apps, link/unlink apps
  - Add UI pages for project detail, project creation, and project listings
  - Add "My Projects" section to home page
  - Add "In Projects" section to app detail page showing which projects contain the app

### Patch Changes

- 44393e7: Fix published app discovery and FastKV publish flow so registry reads use the stored manifest data, publish can succeed after FastKV indexing, and the app explorer links directly to the FastKV config record.
- 44393e7: Refresh the splash-based social metadata and brand assets so the UI ships a stable preview image and matching black-dot favicon set.
- 44393e7: Add under construction page with NEAR CLI integration for session management and development tooling
