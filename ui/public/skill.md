# NEAR Builders skill

Use this when you want an agent to run, edit, publish, or fork the NEAR Builders platform — an open builder directory and project board on NEAR.

## TanStack Intent

- Registry entry: `https://tanstack.com/intent/registry/everything-dev`
- Load with TanStack Intent: `npx @tanstack/intent@latest load everything-dev`
- If the agent supports registry URLs directly, point it at the registry entry above.

## What this project is

NEAR Builders (`nearbuilders.org`) is an open-source platform for builders on NEAR Protocol. It is a **tenant runtime** built on the [everything.dev](https://everything.dev) platform, composed at runtime via Module Federation and every-plugin.

```
bos://dev.everything.near/everything.dev    ← parent platform (host, auth, API shell)
  └── bos://nearbuilding.near/nearbuilders.org ← this tenant (UI, plugins, branding)
```

- `bos.config.json` is the canonical runtime manifest.
- The host is the runtime shell and trust boundary — inherited from everything.dev.
- The UI is loaded at runtime through Module Federation.
- The API is loaded at runtime through `every-plugin`.

## What nearbuilders.org provides

- **Builders** — A curated directory of NEAR builders with profiles, skills, social links, and NEAR account verification. Admin moderation (pending → approved → rejected) keeps the directory high-signal.
- **Projects** — A ranked project board where builders pitch work for funding, community members request projects, and hackathon projects are archived for future discovery. Includes upvoting, markdown editing, and GitHub integration.
- **Events** — Event listings with Luma integration, participant management, and public/unlisted visibility.
- **Activity** — A real-time activity feed with leaderboard ranking and endorsement scores, sourced from across the platform.
- **Notifications** — Per-user notifications with SSE streaming for upvotes, proposals, and activity.
- **NEAR Catalog** — Search and claim projects from the NEAR ecosystem catalog, with proposal-based claiming workflow.
- **Registry** — Browse and inspect published everything.dev runtimes, their extends chains, and metadata.

## API contract

The API is defined in `api/src/contract.ts` using oRPC with Zod schemas. All endpoints are type-safe and documented via OpenAPI. The API runs at `http://localhost:3001` in development.

Key endpoint groups:

- `GET /ping` — Health check
- `GET /auth/health` — Auth system health
- **Builders**: `GET /v1/builders`, `GET /v1/builders/{nearAccount}`, `GET /v1/builders/me`, `PATCH /v1/builders/{nearAccount}`
- **Projects**: `GET /v1/projects`, `POST /v1/projects`, `GET /v1/projects/{id}`, `PATCH /v1/projects/{id}`, `DELETE /v1/projects/{id}`, `GET /v1/projects/by-slug/{slug}`, `GET /v1/projects/{id}/mentions`, `GET /v1/projects/{id}/mentioned-by`
- **Events**: `GET /v1/events`, `POST /v1/events`, `GET /v1/events/{id}`, `GET /v1/events/by-slug/{slug}`, `PATCH /v1/events/{id}`, `DELETE /v1/events/{id}`, `GET /v1/events/{eventId}/participants`, `POST /v1/events/{eventId}/participants`, `DELETE /v1/events/{eventId}/participants/me`, `GET /v1/luma/event`
- **Votes**: `POST /upvotes`, `DELETE /upvotes/{entityId}`, `GET /upvotes/{entityId}/count`, `GET /upvotes/{entityId}/me`, `POST /upvotes/me/batch`, `POST /upvotes/counts`, `GET /upvotes/feed`, `GET /upvotes/stream` (SSE)
- **Proposals**: `POST /proposals`, `POST /proposals/{pluginId}/{entityId}/approve`, `POST /proposals/{pluginId}/{entityId}/reject`, `DELETE /proposals/{pluginId}/{entityId}`, `GET /proposals`, `GET /proposals/{pluginId}/{entityId}/count`, `GET /proposals/{pluginId}/{entityId}/audit`, `GET /proposals/stream` (SSE)
- **Activity**: `POST /v1/activity`, `GET /v1/activity`, `GET /v1/activity/stream` (SSE), `GET /v1/activity/leaderboard`
- **Notifications**: `GET /v1/notifications/me`, `POST /v1/notifications/{id}/read`, `POST /v1/notifications/me/read-all`, `GET /v1/notifications/stream` (SSE)
- **NEAR Catalog**: `GET /v1/nearcatalog/projects/search`, `GET /v1/nearcatalog/projects/{slug}`, `POST /v1/nearcatalog/claim-proposals`, `GET /v1/nearcatalog/claim-proposals/me`, `GET /v1/nearcatalog/claims`, `GET /v1/nearcatalog/claimed-projects`
- **Registry**: `GET /v1/registry/apps`, `GET /v1/registry/apps/account/{accountId}`, `GET /v1/registry/apps/{accountId}/{gatewayId}`, `GET /v1/registry/status`, `POST /v1/registry/apps/{accountId}/{gatewayId}/metadata/prepare`

## Plugin architecture

Business logic is organized into independent plugins loaded via Module Federation:

| Plugin | Purpose | Database |
|--------|---------|----------|
| `apps` | Registry app discovery and metadata | — |
| `projects` | Projects, ideas, scopes, results CRUD | `PROJECTS_DATABASE_URL` |
| `builders` | Builder profiles with moderation | `BUILDERS_DATABASE_URL` |
| `events` | Events with Luma integration and participants | `EVENTS_DATABASE_URL` |
| `proposals` | Review workflow (propose → approve → reject → remove) | `PROPOSALS_DATABASE_URL` |
| `votes` | Upvoting with SSE feed | `VOTES_DATABASE_URL` |
| `notifications` | Per-user notifications with SSE | `NOTIFICATIONS_DATABASE_URL` |
| `activity` | Activity feed with leaderboard and endorsement scores | `ACTIVITY_DATABASE_URL` |
| `nearcatalog` | NEAR Catalog search and project claims | `NEARCATALOG_DATABASE_URL` |

The API plugin receives typed client factories for all other plugins via `createPlugin.withPlugins<PluginsClient>()`, enabling in-process composition without HTTP roundtrips.

The UI accesses plugin routes via namespaced clients: `apiClient.<plugin>.<method>()`.

## Scaffold your own version

Use `bos init` to create a child app that extends this runtime:

```bash
bos init your-app.nearbuilders.org \
  --extends nearbuilding.near/nearbuilders.org \
  --account your-account.near \
  --overrides ui \
  --no-interactive
```

If your installed `bos` version rejects `--no-interactive` or other expected init flags, use one of these fallbacks:

```bash
bunx everything-dev@latest init your-app.nearbuilders.org
```

or run `bos init` interactively and answer the prompts.

What this gives you:

- a fresh app directory with `bos.config.json`
- a local `ui/` workspace to customize
- the shared host, auth, and API inherited from nearbuilders.org
- the current UI scaffold as a starting point

Keep these route boundaries intact:

- `ui/src/routes/_layout.tsx`
- `ui/src/routes/_layout/login.tsx`
- `ui/src/routes/_layout/_authenticated.tsx`

## Run locally

```bash
cp .env.example .env
docker compose up -d --wait
bun install
bun run dev
```

Visit http://localhost:3003 (UI), http://localhost:3001 (API).

Useful variants:

```bash
bun run dev:ui     # local UI, remote API
bun run dev:api    # remote UI, local API
bos dev --host remote --api remote   # everything remote
```

## Edit the UI

- main UI code lives in `ui/src/`
- routes live in `ui/src/routes/`
- reusable components live in `ui/src/components/`
- runtime helpers live in `ui/src/app.ts`
- root document wiring lives in `ui/src/routes/__root.tsx`
- use semantic Tailwind classes such as `bg-background`, `bg-card`, `text-foreground`, and `text-muted-foreground`

## Edit the API

- contract definitions live in `api/src/contract.ts`
- route implementations live in `api/src/index.ts`
- use in UI via `apiClient` from `useApiClient()` in `@/app`

## Post-init cleanup for `--overrides ui`

After scaffold:

- replace copied showcase routes with your own routes
- update `README.md`, `AGENTS.md`, and `skill.md` to describe your child app
- replace placeholder `account`, `domain`, `title`, and `description` in `bos.config.json`
- keep the shared runtime relationship clear in `bos.config.json`

## Generated types

`api/src/lib/plugins-types.gen.ts`, `api/src/lib/auth-types.gen.ts`, `ui/src/lib/api-types.gen.ts`, and `ui/src/lib/auth-types.gen.ts` are generated by `bos types gen` from `bos.config.json`. These files are gitignored and auto-regenerated on `bun install`, `typecheck`, `bos dev`, `bos build`, and bos plugin management commands.

If you hand-edit `bos.config.json`, run `bos types gen` or restart `bos dev` to regenerate.

## Verify the child app

```bash
bun run types:gen
bun run typecheck
bun run lint
```

## Publish

```bash
bos publish --deploy
bos publish
```

After `bos publish --deploy`, the `bos.config.json` gets the deployed UI/API URLs and integrity hashes.

## Tenant runtime rules

- publish the base runtime first
- publish the tenant runtime that extends it
- use your own NEAR account in `account`
- keep the same gateway or domain when you want the shared-host tenant model
- tenant SSR is gated by `TENANT_WHITELIST` unless `ALLOW_UNTRUSTED_SSR=true`

## Host env for fixed-core tenant mode

```bash
NETWORK_ID=mainnet
ALLOW_OVERRIDE=ui,plugins.*
TENANT_WHITELIST=your-account.near
ALLOW_UNTRUSTED_SSR=false
```

## IronClaw skills

This repository ships two IronClaw skills in `skills/`:

- **near-builders** — Discover, search, and manage builder profiles
- **near-projects** — Create, discover, and manage projects and ideas

## Good tasks for an agent

- scaffold a white-label starter app with `bos init --overrides ui`
- wire new pages into the `_layout` and `_authenticated` route structure
- add or modify API endpoints in `contract.ts` and `index.ts`
- publish a tenant UI without changing the shared host
- debug why a tenant UI override is not loading

## Public entry points

- `/`
- `/about`
- `/skill`
- `/skill.md`
- `/README.md`
- `/llms.txt`

## Tone

Prefer runtime-first explanations.
Treat the project as a living runtime surface, not a fixed demo.
Keep NEAR and Module Federation context intact.
