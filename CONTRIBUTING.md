# Contributing Guide

Thank you for contributing to NEAR Builders!

## Quick Setup

```bash
pnpm install                # Install dependencies
docker compose up -d --wait # Start PostgreSQL (one database per service)
pnpm run dev               # Start development; plugins apply their migrations on boot
```

Visit http://localhost:3000 (host), http://localhost:3003 (UI) and http://localhost:3001 (API).

This project uses pnpm. Do not use bun: CI fails on any `bun.lock`.

**Need more details?** See [README.md](./README.md) for architecture overview and [LLM.txt](./LLM.txt) for technical deep-dive.

**Tenant note:** The host and auth plugin run remotely. You only need to run UI and API locally. Host changes should be submitted to the [everything.dev](https://github.com/nearbuilders/everything-dev) parent repository.

## Development Workflow

### Making Changes

- **UI Changes**: Edit `ui/src/` → hot reload automatically → deploy with `bos deploy`
- **Plugin Changes**: Edit `plugins/*/src/` → hot reload automatically → deploy per plugin
- **Config Changes**: Edit `bos.app.ts` → publish with `bos deploy`
- **Host/Auth Changes**: Submit PRs to the parent [everything.dev](https://github.com/nearbuilders/everything-dev) repository

### Plugin Architecture

Business logic lives in independent plugins under `plugins/`:

- **`plugins/apps/`** — FastKV app discovery, metadata publish/relay, on-chain runtime browsing (no database)
- **`plugins/projects/`** — Projects & ideas with upvote ranking, markdown editing, GitHub integration, visibility controls (PostgreSQL)
- **`plugins/builders/`** — Builder profiles with admin moderation, skills, NEAR Social cross-referencing (PostgreSQL)

Each plugin has its own `contract.ts` (oRPC routes + Zod schemas), `index.ts` (plugin factory), `plugin.dev.ts` and `package.json`. The `every-plugin` CLI generates the build config, so plugins ship no rspack config. Routes are namespaced in the UI: `apiClient.apps.*()`, `apiClient.projects.*()`, `apiClient.builders.*()`.

The `api/` package is a thin structural shell with only health/ping routes, upvote endpoints, and shared auth middleware. It composes across all three plugins in-process via `createPlugin.withPlugins<PluginsClient>()` — the API receives typed client factories for each plugin and calls their routers directly without HTTP roundtrips.

Plugin and API variables are configured in `bos.app.ts`:
- API variables: `api.variables` → `config.variables` in `initialize`
- Plugin variables: `plugins.{key}.variables` → plugin's own `config.variables` in `initialize`

Plugins are accessible both directly via HTTP (`/api/{key}/*`) and in-process via the `plugins` clients passed to `createRouter`. The UI uses HTTP; the API uses in-process for composition.

### Environment Configuration

Runtime composition is configured in `bos.app.ts` (published) and `bos.dev.ts` (dev-only overrides) — no rebuild needed. Switch environments:

```bash
pnpm run dev       # Local UI, API and plugins (default)
pnpm run dev:ui    # Local UI, remote API
pnpm run dev:api   # Remote UI, local API
```

Secrets go in `.env` (see [.env.example](./.env.example) for required variables). Key variables for this tenant:

```bash
# plugins.projects (PostgreSQL)
PROJECTS_DATABASE_URL=postgres://everythingdev:everythingdev@localhost:5435/projects_db

# plugins.builders (PostgreSQL)
BUILDERS_DATABASE_URL=postgres://everythingdev:everythingdev@localhost:5434/builders_db

# API (also PostgreSQL)
API_DATABASE_URL=postgres://everythingdev:everythingdev@localhost:5432/api_db

# Auth (inherited from everything.dev)
AUTH_DATABASE_URL=postgres://everythingdev:everythingdev@localhost:5433/auth_db
BETTER_AUTH_SECRET=
```

### Project Documentation

- **[AGENTS.md](./AGENTS.md)** — Operational guide for AI agents
- **[README.md](./README.md)** — Architecture, tenant model, and quick start
- **[LLM.txt](./LLM.txt)** — Technical guide for LLMs and developers
- **[api/README.md](./api/README.md)** — API plugin documentation
- **[ui/README.md](./ui/README.md)** — Frontend documentation
- **[plugins/apps/README.md](./plugins/apps/README.md)** — Apps plugin documentation
- **[plugins/projects/README.md](./plugins/projects/README.md)** — Projects plugin documentation
- **[plugins/builders/README.md](./plugins/builders/README.md)** — Builders plugin documentation

## Git Workflow

### Branch Naming

Create feature branches from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/amazing-feature
```

**Branch naming conventions:**
- `feature/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation changes
- `refactor/description` — Code refactoring
- `test/description` — Test additions/changes

### Semantic Commits

Use [Semantic Commits](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716) for clear history:

```bash
# Format: <type>(<scope>): <subject>
git commit -m "feat(builders): add admin moderation workflow"
git commit -m "fix(projects): resolve upvote count race condition"
git commit -m "docs(readme): update tenant architecture section"
git commit -m "refactor(apps): simplify FastKV metadata resolution"
git commit -m "test(projects): add coverage for idea creation"
```

**Types:**
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `style:` — Code style (formatting, no logic change)
- `refactor:` — Code refactoring
- `perf:` — Performance improvements
- `test:` — Tests
- `chore:` — Build/config/tooling changes

### Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning.

**When to add a changeset:**
- Any user-facing change (features, fixes, deprecations)
- Breaking changes
- Skip for: docs-only changes, internal refactors, test-only changes

**Create a changeset:**
```bash
pnpm run changeset
# Follow prompts to select packages and write description
```

**Changeset file format:**
```markdown
---
"api": minor
"ui": patch
---

Added builder admin moderation workflow
```

**The release workflow:**
1. Changesets action creates a "Version Packages" PR on merge to main
2. On merge of that PR, GitHub releases are created for changed packages
3. Deployments happen automatically via CI

### Pull Request Process

1. **Before creating PR:**
   ```bash
   pnpm run test        # Run all tests
   pnpm run typecheck   # Type check all packages
   pnpm run lint        # Run linting
   ```

2. **Create PR from your fork:**
   - Push branch to your fork: `git push origin feature/amazing-feature`
   - Open PR against `main` branch of upstream repo
   - Use descriptive title following semantic format
   - Fill out PR template if provided

3. **PR requirements:**
   - All tests must pass
   - Type checking must pass
   - Linting must pass
   - Changeset added (if applicable)

4. **After merge:**
   - Delete your branch
   - Changesets action will handle versioning

## Contributing Code

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes
5. **Test** thoroughly: `pnpm run test` and `pnpm run typecheck`
6. **Add changeset** if needed: `pnpm run changeset`
7. **Commit** using [Semantic Commits](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716)
8. **Push** to your fork: `git push origin feature/amazing-feature`
9. **Open** a Pull Request to the main repository

### Code Style

- Follow existing TypeScript patterns and conventions
- Ensure type safety (no `any` types unless absolutely necessary)
- Write descriptive commit messages
- Add tests for new features
- Use semantic Tailwind classes (`bg-background`, `text-foreground`, `text-muted-foreground`)
- No hardcoded colors like `bg-blue-600`
- No code comments in implementation (code should be self-documenting)
- Brand colors: `--brand-green` (`#00D9A3`), `--brand-cobalt` (`#0072CE`), `--brand-chartreuse` (`#F0EC74`)

### Linting

We use [Biome](https://biomejs.dev/) for linting and formatting:

```bash
pnpm run lint        # Check linting
pnpm run lint:fix    # Fix auto-fixable issues
pnpm run format      # Format code
```

## Reporting Issues

Use [GitHub Issues](https://github.com/NEARBuilders/everything-dev/issues) with:

- **Clear description** of the problem
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Environment details** (OS, Node/Bun version, browser, etc.)

## Getting Help

- Check [AGENTS.md](./AGENTS.md) for agent operational guidance
- Check the [README](./README.md) for architecture and tenant model
- Read the [LLM.txt](./LLM.txt) for technical details
- Review workspace READMEs for specific documentation
- Ask questions in GitHub Issues or Discussions

---

Thank you for your contributions!