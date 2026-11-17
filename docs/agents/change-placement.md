# Change placement — bugs, missing capabilities, and pattern improvements

A runtime map (where your repo generates one — everything-dev#591 proposes the
shared kit) says **who owns what**. This says **what to do about it**.
One branch of this document answers one kind of need.

## First rule: sync-owned is a contribution channel, not a fence

A change that belongs in a synced path (`docs/agents/**`, `.agents/skills/**`,
`skills-lock.json`, workflows, `package.json`, AGENTS.md) goes **there** — and
goes **upstream in the same PR**: file or comment on the framework issue that
covers it and link it from your PR body. `bos upgrade` regenerates those files
(and the whole authored half of AGENTS.md) from the parent template, so a local
edit with no upstream counterpart **dies at the next upgrade**. Editing sync-owned
files is how improvements propose themselves; the linked issue is what makes them
permanent.

Do not work around the sync by stashing things in app-owned docs that belong in
the template — every child then re-solves the same problem. Make the improvement
here, describe it upstream, let every child inherit it.

## Branching and stacking

- **Default: one branch per ticket, off `main`.** Small PRs, one tracer bullet
  each.
- **Stack when — and only when — your work builds on unmerged work** (docs
  referencing artifacts that only exist on the base PR, specs for a seam the
  base PR creates). Branch from the **named** base branch
  (`git switch -c mine feat/runtime-map`) and open the PR against that branch.
  Merge order: base first; stacked PRs auto-retarget when the base branch is
  deleted.
- **Never branch from the working tree's current HEAD.** Other sessions share
  this checkout and move it — pre-flighting is cheap and mandatory:
  `git status -sb`, `git log --oneline -3` (whose commits exactly?), then
  `gh pr list` for overlapping work. *Seen in:* a fresh branch here absorbed
  two commits from another session's PR because the tree happened to stand on
  their branch; caught by `git log` before pushing, fixed by recreating from
  the named base.
- **Parallel independent work does not stack — it coordinates.** Before
  starting, scan the open PRs you might overlap with
  (`gh pr view <n> --json files`); real overlap gets a conflict comment on the
  older PR so merge order is agreed, not discovered.

## Bug

1. **Reproduce** it locally.
2. **Classify**: run `bos dev --ui remote --api remote` (or wipe the local
   override) and see if it still reproduces against the **pinned platform**. Two
   cheap classifiers first: the runtime map (whose source owns the failing
   path/behaviour) and the resolved-config comparison in
   [`how-it-fits.md`](how-it-fits.md) (which slots are local overrides vs
   inherited). Code living in the `auth` source is not debugged here.
3. **Local** → fix it, add the test at the seam that caught it.
4. **Upstream** → **search existing issues first** (`gh issue list -R
   NEARBuilders/everything-dev --search "…"`); comment on the matching one with
   the repro, the `platform:` pin, the relevant `.bos/logs/` line, and the
   resolved-config slice if relevant; file new only when the search is empty.
   If you need to keep working now, ship an interim local fix and open the
   follow-up cleanup ticket that links the upstream issue.

Done when: the fix is in the right package and the bug's upstream counterpart
(linked issue) is either applied or parked with a cleanup ticket.

## Clean up at source

Resource cleanup — accumulating logs, stale caches, dead state — gets fixed
**where it is produced**, not hacked around locally: a `TODO(<ticket>)` at the
spot that documents the gap and an upstream issue for the mechanism (log
retention is the standing example: `TODO(#596)`). Locally, deleting a stale
`.bos/logs/*.log` or wiping a stale `regression/` cache is always safe; adding
a local cron, hook, or script to manage the runtime's file lives is not — that
is a child-only fork of a platform responsibility.

## Missing capability

1. **Search before building** — check upstream issues, the framework docs, and
   the TanStack Intent skills (`pnpm dlx @tanstack/intent@latest load
   everything-dev#…`). Someone may have built it.
2. **Build the smallest reference implementation** with a cross-check and tests —
   a generator plus a verify step diffing its output against the real engine
   (the runtime-map generator — shipped in everything-dev#612, see
   `docs/agents/runtime-map.md` — is the model).
3. **File or comment upstream with the reference attached** — ask for the API
   shape you need, show what works.
4. **Keep the interim local, wired sync-safely**, and track the tech debt: hook
   scripts at app-owned keys (not template-owned script names), a cleanup ticket
   linking the upstream issue, and a reminder to verify at the next `bos
   upgrade`.

Done when: the capability is shipped upstream (or parked as linked tech debt)
and every child inherits it instead of each one re-building it.

## Pattern improvement

- **Child-specific** (this app-only concepts): an ADR under
  [`docs/adr/`](../adr/) — the index links upstream ADRs by number.
- **Framework-wide**: an upstream ADR + PR, then a `platform:` pin bump here.
  Decision numbers cited across the repo resolve via
  [`docs/adr/README.md`](../adr/README.md).

Done when: the next agent who hits the same decision finds it already recorded.

## Improving this flow

This file lives in a synced path on purpose. If the flow is wrong, edit it here
and open the upstream issue in the same PR — that is the flow working.
