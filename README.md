<!-- markdownlint-disable MD014 -->
<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD029 -->

<div align="center">

<h1 style="font-size: 4.25rem; font-weight: 800; line-height: 1; margin: 0;">NEAR Builders</h1>

</div>

The open platform for builders on NEAR — discover builders, showcase projects, and get them funded. Built on [everything.dev](https://everything.dev) as a tenant runtime, composed via [Module Federation](https://module-federation.io/) and [every-plugin](https://plugin.everything.dev/), running on [NEAR Protocol](https://near.dev/).

## For builders

Building on NEAR? Start at [nearbuilders.org/build](https://nearbuilders.org/build), join at [nearbuilders.org/join](https://nearbuilders.org/join), or point your coding agent at [nearbuilders.org/skill.md](https://nearbuilders.org/skill.md).

## Builders

A curated directory of NEAR builders. Every builder gets a profile — skills, social links, NEAR Social cross-referencing, and on-chain verification. Admin moderation (pending → approved → rejected) keeps the directory high-signal.

Builder profiles are the connective tissue of the ecosystem. They make builders discoverable, make past work verifiable, and make it easy for projects and teams to find the right people.

## Projects

A project dashboard where builders pitch their work for funding and NEAR Legion members request projects they want built.

But it's more than a pitch board:

- **Hackathon project database** — Every past hackathon project in one place, not lost to event pages that disappear. A living source of potential projects and teams worth continuing.
- **Community-upgraded ideas** — Ideas get upvoted, refined, and matched with builders who can execute them. The best surface organically.
- **Talent & team retention** — Hackathon teams that worked well together stay discoverable. Good combos persist, not just good projects.
- **Make the most of hackathons** — The energy and output from every event feeds back into the platform, so nothing gets lost and everything compounds.

Projects and ideas get upvote ranking, markdown editing, GitHub README integration, and on-chain app linking.

## Run or fork NEAR Builders

This section is for people who want to run, edit, publish or fork the platform. Builders getting started on NEAR should read [skill.md](https://nearbuilders.org/skill.md) instead.

### Tenant runtime

NEAR Builders is a **tenant runtime** built on [everything.dev](https://everything.dev), composed at runtime via Module Federation and every-plugin:

```
bos://dev.everything.near/dev.everything.dev   ← parent platform (host, auth, API shell)
  └── bos://nearbuilding.near/nearbuilders.org ← this tenant (UI, API, plugins, branding)
```

- `bos.config.json` is the canonical runtime manifest.
- The host is the runtime shell and trust boundary, inherited from everything.dev.
- The UI is loaded at runtime through Module Federation.
- The API and plugins are loaded at runtime through `every-plugin`.

### Run locally

```bash
git clone https://github.com/NEARBuilders/nearbuilders.org.git
cd nearbuilders.org
cp .env.example .env          # Add your secrets
docker compose up -d --wait   # Start PostgreSQL (one database per service)
bun install
bun run dev                   # Starts UI + API locally, host is remote
```

Visit http://localhost:3003 (UI), http://localhost:3001 (API).

Useful variants:

```bash
bun run dev:ui     # local UI, remote API
bun run dev:api    # remote UI, local API
```

### Plugins

Business logic lives in independent plugins loaded via Module Federation:

| Plugin | Purpose | Database |
|--------|---------|----------|
| `apps` | Registry app discovery and metadata | — |
| `projects` | Projects, ideas, scopes, results and collaborators | `PROJECTS_DATABASE_URL` |
| `builders` | Builder profiles, moderation and nominations | `BUILDERS_DATABASE_URL` |
| `events` | Events with Luma integration and participants | `EVENTS_DATABASE_URL` |
| `proposals` | Review workflow (propose → approve → reject → remove) | `PROPOSALS_DATABASE_URL` |
| `votes` | Upvoting with SSE feed | `VOTES_DATABASE_URL` |
| `bookmarks` | Bookmarks | `BOOKMARKS_DATABASE_URL` |
| `notifications` | Per-user notifications with SSE | `NOTIFICATIONS_DATABASE_URL` |
| `activity` | Activity feed with leaderboard and endorsement scores | `ACTIVITY_DATABASE_URL` |
| `nearcatalog` | NEAR Catalog search and project claims | `NEARCATALOG_DATABASE_URL` |
| `nostr` | Nostr integration, extended from `bos://nearbuilding.near/nostr.nearbuilders.org` | — |

The API plugin receives typed client factories for all other plugins via `createPlugin.withPlugins<PluginsClient>()`, enabling in-process composition without HTTP roundtrips. The UI accesses plugin routes via namespaced clients: `apiClient.<plugin>.<method>()`.

### API

The API contract is defined in `api/src/contract.ts` using oRPC with Zod schemas, and route implementations live in `api/src/index.ts`. In the UI, use `apiClient` from `useApiClient()` in `@/app`.

The deployed API serves interactive docs at `/api`, the OpenAPI spec at `/api/spec.json`, and oRPC at `/api/rpc` (for example https://nearbuilders.org/api).

### Edit the UI

- Main UI code lives in `ui/src/`.
- Routes live in `ui/src/routes/`; TanStack Router generates the route tree.
- Reusable components live in `ui/src/components/`.
- Runtime helpers live in `ui/src/app.ts`.
- Root document wiring lives in `ui/src/routes/__root.tsx`.
- Use semantic Tailwind classes such as `bg-background`, `bg-card`, `text-foreground` and `text-muted-foreground`.

### Generated types

`api/src/lib/plugins-types.gen.ts`, `api/src/lib/auth-types.gen.ts`, `ui/src/lib/api-types.gen.ts` and `ui/src/lib/auth-types.gen.ts` are generated by `bos types gen` from `bos.config.json`. These files are gitignored and regenerated on `bun install`, `typecheck`, `bos dev`, `bos build` and bos plugin management commands.

If you hand-edit `bos.config.json`, run `bos types gen` or restart `bos dev` to regenerate.

### Verify

```bash
bun run typecheck
bun run lint
bun run test
```

### Scaffold your own version

Use `bos init` to create a child app that extends this runtime:

```bash
bos init \
  --extends bos://nearbuilding.near/nearbuilders.org \
  --account your-account.near \
  --domain your-app.example.com \
  --overrides ui \
  --no-interactive
```

If your installed `bos` version rejects these flags, run `bunx everything-dev@latest init` or run `bos init` interactively and answer the prompts.

This gives you a fresh app directory with `bos.config.json`, a local `ui/` workspace to customize, and the shared host, auth and API inherited from nearbuilders.org.

Keep these route boundaries intact:

- `ui/src/routes/_layout.tsx`
- `ui/src/routes/_layout/login.tsx`
- `ui/src/routes/_layout/_authenticated.tsx`

After scaffolding with `--overrides ui`:

- Replace copied showcase routes with your own routes.
- Update `README.md`, `AGENTS.md` and `ui/public/skill.md` to describe your child app.
- Replace placeholder `account`, `domain`, `title` and `description` in `bos.config.json`.
- Keep the shared runtime relationship clear in `bos.config.json`.

### Publish

```bash
bos publish --deploy   # build, deploy, then publish the config
bos publish            # publish the config only
```

After `bos publish --deploy`, `bos.config.json` gets the deployed UI/API URLs and integrity hashes.

### Tenant runtime rules

- Publish the base runtime first.
- Publish the tenant runtime that extends it.
- Use your own NEAR account in `account`.
- Keep the same gateway or domain when you want the shared-host tenant model.
- Tenant SSR is gated by `TENANT_WHITELIST` unless `ALLOW_UNTRUSTED_SSR=true`.

Host env for fixed-core tenant mode:

```bash
NETWORK_ID=mainnet
ALLOW_OVERRIDE=ui,plugins.*
TENANT_WHITELIST=your-account.near
ALLOW_UNTRUSTED_SSR=false
```

### TanStack Intent

Agents working on the platform can load the everything.dev skills with [TanStack Intent](https://tanstack.com/intent/registry/everything-dev):

```bash
npx @tanstack/intent@latest load everything-dev
```

`AGENTS.md` lists the individual skills to load before editing specific areas.

## Railway

This is a tenant deployment — the Docker image inherits from the parent and overlays nearbuilders.org configuration.

- Image source: `ghcr.io/nearbuilders/everything-dev:latest`
- Staging: `ghcr.io/nearbuilders/everything-dev:staging`

Required runtime vars (in addition to inherited ones):

- `APP_ENV` — `production` or `staging`
- `API_DATABASE_URL` — API database connection string
- `PROJECTS_DATABASE_URL` — Projects plugin database
- `BUILDERS_DATABASE_URL` — Builders plugin database
- `NOMINATION_TOKEN_SECRET` — Nomination token signing secret, at least 32 characters
- `BETTER_AUTH_SECRET` — Session encryption key

## Lint Setup

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
bun lint        # Check linting
bun lint:fix    # Fix auto-fixable issues
bun format      # Format code
```

Biome is configured in `biome.json` at the project root. Generated files (like `routeTree.gen.ts`) are automatically excluded.

## Tech Stack

**Frontend:**

- React 19 + TanStack Router (file-based) + TanStack Query
- Tailwind CSS v4 + shadcn/ui components
- Module Federation for microfrontend architecture
- Builder directory with admin moderation workflow
- Project board with live upvote ranking (SSE)

**Backend:**

- Hono.js server + oRPC (type-safe RPC + OpenAPI)
- [every-plugin](https://plugin.everything.dev/) architecture for modular APIs
- Effect-TS for service composition

**Database & Auth:**

- PostgreSQL + Drizzle ORM (one database each for api, auth and every plugin)
- Better-Auth with NEAR SIWN (inherited from everything.dev)

## Related Projects

- **[everything.dev](https://everything.dev)** — The parent runtime platform that nearbuilders.org extends
- **[every-plugin](https://plugin.everything.dev/)** — Plugin framework for modular APIs with typed contracts and runtime composition
- **[near-kit](https://kit.near.tools)** — Unified NEAR Protocol SDK
- **[better-near-auth](https://github.com/elliotBraem/better-near-auth)** — NEAR SIWN + gasless relay for Better-Auth

## NEAR Ecosystem

nearbuilders.org sits within a broader ecosystem building a verifiable internet on NEAR:

- **[BOS](https://near.social/)** — Composable on-chain frontend components
- **[web4](https://web4.near.page)** — Web apps as verifiable on-chain smart contracts
- **[near-dns](https://github.com/frol/near-dns)** — Blockchain-backed DNS resolution
- **[NameSky](https://namesky.app)** — Named accounts as tradeable on-chain assets
- **[OutLayer](https://outlayer.fastnear.com)** — TEE-attested verifiable off-chain computation
- **[NEAR Intents](https://intents.near.org)** — Intent-based cross-chain settlement ($15B+ volume)
- **[NEAR Catalog](https://nearcatalog.xyz)** — NEAR ecosystem app catalog
- **[NEAR AI](https://near.ai)** — AI agents and infrastructure on NEAR

## License

MIT
