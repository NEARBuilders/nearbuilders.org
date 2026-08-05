<!-- markdownlint-disable MD014 -->
<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD029 -->

<div align="center">

<h1 style="font-size: 4.25rem; font-weight: 800; line-height: 1; margin: 0;">NEAR Builders</h1>

</div>

The open platform for builders on NEAR — discover builders, showcase projects, and get them funded. Built on [everything.dev](https://everything.dev) as a tenant runtime, composed via [Module Federation](https://module-federation.io/) and [every-plugin](https://plugin.everything.dev/), running on [NEAR Protocol](https://near.dev/).

## Getting Started

```bash
git clone https://github.com/nearbuilders/everything-dev.git
cd nearbuilders.org
cp .env.example .env   # Add your secrets
docker compose up -d --wait   # Start PostgreSQL (4 databases)
bun install
bun run dev              # Starts UI + API locally, host is remote
```

Visit http://localhost:3003 (UI), http://localhost:3001 (API).

## Tenant Runtime

This repository is a **tenant runtime** that extends the parent `everything.dev` platform:

```
bos://dev.everything.near/everything.dev    ← parent platform (host, auth, API shell)
  └── bos://work.efiz.near/nearbuilders.org ← this tenant (UI, plugins, branding)
```

**What nearbuilders.org provides:**

- **Builders** — A curated directory of NEAR builders with moderation, skills, and social links
- **Projects** — A ranked project board with upvoting, markdown editing, and GitHub integration
- **Custom UI** — Branding, navigation, and pages tailored for the builder community

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

- PostgreSQL + Drizzle ORM (4 databases: api, auth, projects, builders)
- Better-Auth with NEAR SIWN (inherited from everything.dev)

## IronClaw Skills

This repository ships two [IronClaw](https://ironclaw.com) skills that give AI agents working knowledge of the NEAR Builders platform. Place the `skills/` directory in your IronClaw workspace (or `~/.ironclaw/skills/` for global access) and the agent will activate them when relevant.

- **near-builders** — Discover, search, and manage builder profiles. Activates on mentions of builders, talent search, or the NEAR Builders directory.
- **near-projects** — Create, discover, and manage projects and ideas. Activates on mentions of projects, ideas, hackathons, funding, or pitching.

```bash
# Install skills globally
cp -r skills/near-builders ~/.ironclaw/skills/
cp -r skills/near-projects ~/.ironclaw/skills/
ironclaw skills list   # Verify they loaded
```

Browse more skills at [IronHub](https://hub.ironclaw.com).

## Related Projects

- **[IronClaw](https://ironclaw.com)** — Secure AI agent OS with sandboxed skills and tools
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
