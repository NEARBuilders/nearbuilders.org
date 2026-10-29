# Coding standards

Review-time rules. Each entry earns its place by a concrete failure a runtime
repo has seen; mechanical violations get deterministic checks instead of prose
here. App-specific standards (such as a CI gate-flip policy) stay in your
repo's own standards file.

## Write code once

Create as little code as necessary, in succinct concise ways — and aim to write
code **once**: we fix an issue once and everyone gets it; we build a feature
once and everyone gets it. That is the purpose of the plugins and the
distribution. A fix that lives only in this repo is not a fix; it is a fork
every child re-solves. When a PR changes behaviour, ask: *could this land
upstream instead, so every child inherits it?* Ship the improvement here
(progress beats waiting for a release) **and** open the upstream counterpart in
the same PR — that pairing is the write-once rule in action.

*Seen in:* a child broke its local auth screens out into a clean local
architecture, then the same screens shipped upstream and every child deleted
their local copy — write-once is the follow-through.

## Type safety is the drift killer

Use the framework's type safety to **eliminate drift**: infer types from schemas
and clients, never restate what a client or schema already confesses. Generated
artifacts (`*.gen.ts`) beat hand-maintained mappings; when a hand-maintained
constant parallels something a schema, manifest, or client already knows, it is
a driftable copy — derive it, derive it into the generator, or delete it.

*Seen in:* hand-written remote-route literals scattered across many files —
breadcrumbs and path prefixes hardcoded from routes upstream could rename at any
moment; deriving them from the generated route inventory (`bos types gen`
artifacts) turns every upstream rename into a typecheck failure instead of a
silent mismatch.

## Workarounds: ship it locally, upstream it immediately

A workaround is allowed — but it pairs with (1) an upstream issue or comment
with a reference implementation attached, (2) a follow-up cleanup ticket that
links it, and (3) wiring that an upgrade cannot silently break. An interim with
no upstream link is an undocumented fork the next `bos upgrade` clobbers; an
interim **with** one is a contribution.

*Seen in:* a child shipped a generator script as a local workaround **while**
its upstream issue waited — the startup wiring sat in a template-owned
`package.json`, and `bos upgrade` regenerates AGENTS.md wholesale, so both only
survived because the upstream link made the change the template's job.

## Comments: none in implementation — `KEEP` earns it, `TODO` points at a ticket

Implementation files carry no comments. Agents and reviewers **clean up as
they work**: when you touch a file, delete the comments it no longer needs; you
do not need a cleanup PR to remove a comment. Two exemptions:

- **`KEEP:`** — a comment may survive only with a `KEEP:` prefix, and only if it
  states what no code confesses (the why, the gotcha, the invariant). Unmarked
  comments are deletable on sight.
- **`TODO(<ticket>)`** — allowed only with a reference to tracked work, e.g.
  `TODO(#613)` (upstream issue) or `TODO(runtime-map/04)` (`.scratch` ticket).
  A bare `TODO:` is a review violation: attach the ticket or delete it.

Both markers are greppable contracts: `KEEP` means *this comment was argued
for*, `TODO` means *this debt has a ticket*. Any other comment in a diff is a
removal candidate.

## Unnecessary tests

A test earns its place by pinning a behavior the type system or a framework
suite cannot pin. Delete tests that re-test mocking scaffolding, assert
framework internals, or duplicate a test at a lower seam. Comments and tests
creep in when review accepts them by default — both are deletions-first.

*Seen in:* unmarked comments surviving in long-lived implementation files, and
regression suites growing one seed helper per spec — each re-running the auth
migrations and re-implementing cookie minting instead of one shared seed module.
Deletions-first is the phase-out: cleanup when the file is touched, not a
dedicated cleanup PR.
