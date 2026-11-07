# Testing doctrine — when to test, where, and what the parent covers

Companion to your repo's tests README (commands and prerequisites live there) and
[`change-placement.md`](change-placement.md). This document is the *judgement
layer*: it tells you when to write a test at all, which layer owns it, what to
assume the parent framework already covers, and how to write a regression test
that fits this setup instead of fighting it.

## When to write a test — and when not to

Write a test when it pins a behavior at a seam **you own**:

- contract behavior a type cannot express (permissions, state transitions, error shapes)
- a composed journey only this app's routes/plugins produce
- a claim you generated and must keep honest (see `verify-runtime-map`)

Do **not** write a test when something already pins it:

- the type system (a renamed route, a schema shape, a client signature — the generated artifacts fail typecheck first)
- the parent framework's own suites: composition, mounts, core-wins, hydrate/SSR parity, digest parity — tested in the framework repo, not here (see *Coverage boundary* below)
- a lower seam: an integration test on the router beats five component tests firing the same fetch through jsdom mocks

Deletions-first applies to tests as to comments
([`coding-standards.md`](coding-standards.md)): suites that re-test
mocking scaffolding, or that duplicate coverage available one seam lower, get
deleted when touched, not maintained. *Seen in:* five regression seed helpers
each re-running auth migrations and re-implementing cookie minting — one shared
seed module is the fix, tracked at retro 2026-10-24.

## The layers, fast → slow

| Layer | Where | Owns |
|---|---|---|
| **Unit** — PGLite in-memory, no Docker, no stack | `api/tests/unit`, `plugins/*/src/__tests__`, colocated `ui/src/**/*.test.tsx` | pure logic, service behavior, reducers |
| **Integration** — the real oRPC router in-process, auth context injected via headers, DAO checks mocked | `api/tests/integration` | contract behavior: who may do what to which resource, error shapes, transactions |
| **Regression** — the full composed `bos dev` stack, real browser, real remote auth UI | `tests/regression/browser/specs` | rendered journeys: sessions, SSR/CSR compose, navigation, admin flows |

Choose the lowest layer that pins the behavior. Escalate when the failure you
are preventing only materializes one layer up (cookie handling, hydration,
loading states, module loading are things jsdom cannot even reproduce).

## What to assume the parent covers — and what to cover here

**Assume covered upstream** (framework suite in `NEARBuilders/everything-dev`,
tagged with your `platform:` pin; published npm packages carry no tests — don't
look in `node_modules`):

- the composition engine itself: `constructTree` precedence, core-wins,
  peer-collision throws, mount registry, gates, nav assembly
- SSR/client construction parity, digest computation, compose-payload schema
  checks, degrade-to-core-only semantics
- the framework's client machinery: session refresh, MF loader retry chains

Prove claims about *your* composition state without re-testing the engine:
`pnpm run verify:runtime-map` diff-checks the generated map against the real
`constructTree` — that is the cheap regression for "who owns what" questions.

**Cover here:**

- your plugin contracts and permission edges (`api/tests/integration`, plugin units)
- your composed journeys (regression specs): sign-in → org → team → proposals →
  onboarding code redemption — the flows unique to this app's config and screens
- your generated artifacts staying honest (`verify-runtime-map`,
  `gen-runtime-map` unit tests as the model)

Upstream **everything-dev#593** proposes an every-plugin *test* slot with
layered consumer regression — the framework-side home for the parent/child
boundary above; until it lands, this document is the contract.

## Fit with the regression setup

- **Every invocation pays the whole stack boot** — `reuseExistingServer: false`,
  5-minute webServer budget, `BOS_NO_WATCH=1`. One journey per spec that needs
  the stack is fine; five separate one-test spec files are five stack boots.
  Batch journeys by theme.
- **The cache is real**: `global-setup` seeds users/orgs once and writes
  cookies to `.bos/regression/*.json`. Specs `injectCookies` — reuse the
  cached session; mint a new state only when the fixtures don't cover it, and
  route the seeding through the shared HTTP helpers
  (`tests/regression/lib/http-seed.mjs` and the bootstrap-admin API key is
  the supported path — the stack database is in-process pglite, so direct DB
  writes are impossible).
- **Serial by design**: `workers: 1`, `fullyParallel: false`, `retries: 1` —
  specs share ports and the seeded cookie cache. Don't write a spec that
  assumes a clean global state another spec might have breathed on; seed
  fixtures for per-spec state.
- **The stall watchdog** fails after ~120 s of zero test progress: a spec that
  can hang waits explicitly (bounded `waitFor`, assertions with timeout), it
  doesn't spin silently.

## Writing a good regression test

1. Name it for the journey ("owner sees whether visitors see each event"), not
   the component.
2. Assert through the UI — rendered text, role selectors, real navigation. Never
   reach into internals the user journey doesn't produce.
3. Seed only what differs from the fixtures; lean on the cached session
   otherwise.
4. Keep it tolerant in styling/locale (class names and translations change),
   strict in data (ids, counts, membership, error states).
5. If it exercises a remote-owned screen (`/login`, `/settings/*`), it is still
   a valid journey test here — assert the outcome, not the auth plugin's
   internals.
6. Run it in isolation once (`--grep`) and once in the batch; both green is the
   completion criterion — the serial runner is where shared-state surprises
   show up.
