---
name: everything-dev-app
description: Orient in an everything.dev app repo created via `bos init` and run the ordered development workflow end to end. Use when starting work in a scaffolded child repo, deciding which workflow skill to use next, planning a feature, fixing a bug, or publishing changes to your runtime.
---

# Everything.dev App Workflow

You are in an everything.dev app: a child repo scaffolded by `bos init` that **extends** a parent runtime on-chain. Your overrides (typically `ui/`, maybe `api/`, `plugins/`) are local; everything else resolves from the parent at runtime via `bos.app.ts` (`extends` chain, FastKV-published).

Read `AGENTS.md` first — it has the run, deploy, and architecture guidance for this specific repo.

## The ordered flow

Work in this order. Each step names the skill that owns it. `/ask-matt` is the router if you are unsure where you are.

1. **Sharpen the idea** — `/grill-with-docs` interviews until the design is sound, leaving a paper trail in `GLOSSARY.md` and `docs/adr/`. For pure decisions without docs, `/grilling`. For handing a plan to a future session, `/to-spec`.
2. **Chart the work** — `/to-tickets` breaks the spec into tracer-bullet tickets (vertical slices, each demoable, each declaring blocking edges) under `.scratch/<feature>/issues/`. For huge, foggy efforts, `/wayfinder` instead.
3. **Work the frontier** — pick any ticket whose blockers are done. `/implement` builds it, driving `/tdd` at pre-agreed seams. `/diagnosing-bugs` is the loop for hard bugs and performance regressions. If your ticket builds on unmerged work, stack on that branch — base your branch on the *named* base PR's branch, never on whatever the working tree happens to have checked out (`docs/agents/change-placement.md` → Branching and stacking).
4. **Review** — `/code-review` audits the diff since a fixed point on two axes: Standards (this repo's documented conventions) and Spec (what the ticket asked for).
5. **Ship** — `bos deploy` runs the full train (preflight → build → upload bundles → publish config to FastKV → image/Railway). Deploy surface details live in `AGENTS.md`.

## Where things live

- `docs/agents/issue-tracker.md` — tracker conventions (local `.scratch/<feature>/issues/` + GitHub when published)
- `docs/agents/triage-labels.md` — the five canonical triage roles
- `docs/agents/domain.md` — domain doc layout (GLOSSARY.md / ADRs)
- `AGENTS.md` — run, deploy, architecture, and style rules for this repo

## Investigate narrowly

Do not excavate framework internals. Rules of thumb:

- **Generated files are never hand-edited** — anything `*.gen.ts` (API/auth types) regenerates from `bos.app.ts` via `pnpm run types:gen`. Change the config or the generator, not the artifact.
- **Framework-owned files may be edited locally** — files carrying the `FRAMEWORK-OWNED` header (build configs, db/lib plumbing, workflows; inventory in ADR 0032) are reconciled from the parent template by `bos sync`/`bos upgrade`: the template wins on the next sync and your copy is backed up under `.bos/sync-backup/`. Edit them when the work needs it — then **file an issue at https://github.com/NEARBuilders/everything-dev/issues** describing the change so it is implemented upstream and shipped in package versions. A local edit without an upstream issue is an undocumented fork.
- **Framework code resolves from npm**, not from your repo — host, auth, and plugin runtime behavior is inherited from the parent via `extends`. To understand or change it, load the matching TanStack Intent skill (`pnpm dlx @tanstack/intent@latest load everything-dev#...`, `every-plugin#...`, `better-near-auth#...`) instead of hunting source. For composition/route-shadowing, load `everything-dev#v1-to-v2-upgrade`.
- **One platform pin, everything derived** (ADR 0034) — the authored config's `platform: "<framework-version>"` field pins the framework release; the catalog, image ref (`ref@v<version>`, never hand-pinned), sync source (release tag, not `main`), and compat contract all derive from the resolved platform release manifest. Absent = latest via extends. `bos upgrade --check` is the manual drift alarm (exit 1 = updates available; prints what drifted); `bos platform manifest` shows what resolves.
- **Your repo owns the overrides only** — UI routes you add under `ui/src/routes/`, API routes in `api/src/contract.ts` + `api/src/index.ts`, your plugins under `plugins/`. Start searches there.
- **Run `/setup-matt-pocock-skills` once** before using the tracker/triage skills; it configures the issue tracker, triage vocabulary, and domain doc layout for this repo.
