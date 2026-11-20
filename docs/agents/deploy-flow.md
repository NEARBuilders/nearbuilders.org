# The publish-to-user deploy flow

How a merge becomes what users see: what a `bos deploy` changes, how each kind of change reaches a running app, who sees the update banner and when, and what to do when a deploy fails. Agent-facing and plain-words; the deep machinery lives in the code this doc names.

## The flow

```
branch → PR → CI green → merge to main (your repo)
   → your CI runs `bos deploy`   (build · upload bundles · publish config to FastKV)
   → the platform moves the new generation to the running app (hot vs replaced, below)
   → open signed-in tabs show "A new version is available — Refresh"
   → the user clicks Refresh and gets whatever changed in the published config
```

No git machinery around this: no auto-merge, no upgrade PRs, no bots. A deploy is a config publish; "publish is the deploy."

## What a publish changes — and how it reaches the user

| Changed in the published config | Mechanism | Restart? |
|---|---|---|
| `app.ui`, `plugins.<id>.ui`, `app.auth.ui` (browser/SSR bundles) | **Hot.** The running host's pointer watch (`host/src/services/snapshot-watch.ts`, 30 s) re-resolves the published pointer, SRI-verifies the candidate, pre-warms the composition, and swaps the serving snapshot atomically (`host/src/services/snapshot-coordinator.ts`). A failed verification leaves the live generation serving. | No |
| `app.api`, `app.auth` (backends), `plugins.<id>` (backends), the api's `variables`/`secrets`, `app.host`, the framework release/image | **Boot-frozen.** The swap cannot reload server plugins, so the running instance keeps the old generation and reports the moved pins as `restartRequired` on `/health` and `/.well-known/version`. The reconciler replaces the instance (blue/green), and the replacement boots UI and backends together. | Yes |

### The coherence guard

Without help, a backend publish is briefly incoherent: the old instance would adopt the new UI within 30 s while still running the old API — the window where new UI calls routes the old API lacks. `BOS_HOLD_ON_BACKEND_CHANGE=1` (set by the hosting adapter's descriptor; **default off**, so single-box and self-hosted behavior is unchanged) makes the host refuse that swap: `adoptTransaction` records `pendingRestart: [...]` next to `restartRequired` on `/health` and `/.well-known/version`, and keeps serving a coherent old UI+API pair until the reconciler replaces the instance. The generation then moves as a unit. Decision logic and tests: `host/tests/unit/snapshot-coordinator-hold.test.ts`.

### The backward-compatibility rule

After an instance is replaced, open tabs still run the **previous UI against the new API** until each user clicks Refresh. Therefore: **API and plugin changes must stay backward compatible with the previous UI generation for at least one release cycle.** A breaking change ships in two deploys — first add the new shape (old UI keeps working), then remove the old shape once the previous UI generation is retired.

## Who sees the banner, and when

**Signed-in sessions only, on visible tabs** — the banner polls `/.well-known/version` every 60 s (`packages/everything-dev/src/ui/version-check.ts`) and arms only after a resolved session (`ui/src/components/version-refresh-banner.tsx`). Anonymous visitors pick new versions up naturally on their next page load; no new complexity is built for them. Dismissal lasts the session (sessionStorage).

Timing: the host checks the published pointer every 30 s and the tab polls every 60 s, so the worst case is ~90 s from merge to banner. Each poll is an inbound request — an open tab keeps an auto-stop machine awake. That is acceptable by default (someone is using the app); ticket 02's cold-start measurements revisit it if the cost proves real.

## What the reconciler restarts

The reconciler (fly-hosting 08) converges hosted instances to each namespace's latest published pointer. Its restart key hashes the backend remote digests, the image digest, and the secrets version — **a UI-only publish leaves it unchanged, so nothing restarts**; the hot path above already moved the UI. Backend, host, image, or secrets changes converge via the adapter's blue/green deploy (never stop-then-start): the replacement boots against the new pointer, a failed health gate leaves the old generation serving and marks drift. Until the reconciler is enabled, the running instance picks backend changes up on its next restart, and `restartRequired`/`pendingRestart` on `/health` is the operator's signal.

## Secrets a child repo needs

| Secret | Purpose |
|---|---|
| `NEAR_PRIVATE_KEY` | Signs the FastKV config publish |
| `BOS_STORAGE_API_KEY` | Bundle upload to the R2-backed storage (mint once with `bos login --key`) |

Railway tokens (`RAILWAY_TOKEN`, optionally workspace-scoped `RAILWAY_API_TOKEN`) are only needed until fly-hosting 13 deletes the child Railway leg — once the reconciler actuates children, publishing is the deploy and those secrets can be deleted. See `.github/workflows/README.md` for the exact secret table while the transition lasts.

## Framework upgrades

```
bos upgrade --dry-run   # the plan: files to write, package bumps, release retarget
bos upgrade             # apply (re-targets the latest platform release)
bos lock                # freeze the resolved composition; commit the lock
# merge → your CI deploys; the reconciler replaces instances pinned to the old image
```

`bos upgrade --check` is the drift alarm (exit 1 = updates available). The fleet console (fly-hosting 10) shows a read-only "behind release X — run `bos upgrade`" indicator; **no button edits a repo**. Image-only patches under a fixed release (fly-hosting 15) are the only thing the platform may roll without a commit.

## Rollback

Rollback is a console action, not a git revert: `/deploys` re-publishes the previous verified snapshot (config half, fly-hosting 06 — `rolledBackFrom` is stamped on the deploy record), and the reconciler converges the instance to the rolled-back pin (instance half, fly-hosting 08; console surface in fly-hosting 10). Pre-cutover snapshots are refused, not guessed.

## What a failing deploy looks like

| Symptom | Meaning | Fix |
|---|---|---|
| Preflight refuses immediately | Missing `NEAR_PRIVATE_KEY` / `BOS_STORAGE_API_KEY`, or a `postgres://` secret that does not resolve | Set the secrets in the repo, re-run the deploy |
| Publish train truth gate / `bos mf check` fails | A plugin bundle was built against a Module Federation runtime the host does not share (`ModuleFederationError`, `SharedSingletonSkewError`) | Redeploy the stale plugin (`bos plugin publish <key>`, or `bos deploy` from the root) and re-run `bos mf check` |
| Post-publish smoke fails | The pinned image booted against the just-published config and failed health/SSR/OpenAPI — the train rolls the config back to the previous FastKV snapshot before failing | Read the smoke failure in the deploy run, fix the breakage, deploy again; users never saw the broken generation |
| Instance shows drift in the console | The running image/config differs from the deploy record (`image-unresolvable`, `health-timeout`, `adapter-failure`, `pointer-unverifiable`) | Follow the row's remediation string; the reconciler re-converges on its next tick |
| Deploy green, banner never appears | The tab is anonymous or backgrounded (banner is signed-in + visible only), the digest did not change (pointer adopted as `unchanged`), or the watch failed (check `watch.lastOutcome` on `/.well-known/version`) | Verify signed-in + visible tab; compare `deploymentDigest` before/after; adopt failure retries with backoff |

## Verification

- Guard decision: `pnpm --filter host test` (`host/tests/unit/snapshot-coordinator-hold.test.ts` — UI+API publish held, UI-only swapped, flag off = old behavior).
- Banner end to end: `tests/regression/browser/specs/update-banner.spec.ts` (banner within the poll window → Refresh → dismiss lasts the session; backend variant; poll survives a failing endpoint; anonymous tabs never poll).
