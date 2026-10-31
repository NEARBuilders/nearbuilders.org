# Explore: row-level security for the shared auth database

Exploration for #333. The question: once several apps point `AUTH_DATABASE_URL` at one Postgres, should row-level security (RLS) or scoped roles harden it?

**Recommendation:** don't turn on RLS. Use scoped Postgres roles plus network controls, and make a few upstream changes that matter more than RLS would. Per the framework-owned-file protocol, all of it belongs in everything-dev (auth plugin and db layer), not here.

Sources: everything-dev `main` (`b86f6407`) and this repo at `bd322ed`. Paths below starting with `plugins/auth`, `packages/` or `host/` are in everything-dev.

## Today's setup

### Who holds credentials

| Holder | How | What it can touch |
|---|---|---|
| The auth plugin in each app process (nearbuilders.org through `extends`, citynode.app, feedback.nearbuilders.org, everything.dev) | `AUTH_DATABASE_URL` → `databaseLayer(..., { namespace: false })` (`plugins/auth/src/db/layer.ts:28-37`); `pg.Pool`, max 10 (`packages/everything-dev/src/db/driver.ts:146-155`) | Everything. It runs migrations at boot (`packages/everything-dev/src/db/layer.ts:66-69`), so the role must own the tables and be able to `CREATE SCHEMA drizzle`. |
| The host | No direct access. Sessions resolve through the auth plugin's in-process client (`host/src/services/auth.ts:89-135`). | – |
| The other plugins in this repo | None. Each uses its own `*_DATABASE_URL`, and ADR 0033 keeps the db tag plugin-local. | – |
| Operator scripts | `plugins/credits/scripts/audit-credits-eligibility.ts` opens `AUTH_DATABASE_URL` with raw `pg` and reads every `near_account` row. It is "read-only" only through `SET default_transaction_read_only`, which the session can undo. | Everything the URL's role can. |
| Regression test helpers (upstream and citynode) | Write test rows directly. | Test databases only. |

ADR 0027 already runs auth twice against one shared database, for two deployments (`docs/adr/0027-apps-decomposition-every-app.md:59`). That requires a shared `BETTER_AUTH_SECRET` and a single relay writer.

**Fallback hazard:** if `AUTH_DATABASE_URL` is unset, the host fills it with `API_DATABASE_URL` (`host/src/services/plugins.ts:169-185`). The auth tables then land in the API database's `public` schema without any error.

### Tables

All tables are in `public` (`plugins/auth/src/db/schema.ts`):
- `user`, `session`, `account`, `verification`
- `near_account`, `passkey`
- `organization`, `member`, `invitation`, `team`, `team_member`
- `apikey`, `device_code`, `device_link_claim`
- `onboarding_code`, `onboarding_redemption`
- `relayed_transaction`, `funded_gas_key`, `relayer_key`, `custody_wallet`
- `referral_code`, `referrals`, `referral_step_completion`

**No table has an app or tenant column.** The only app-like column is `client_id` on the device-link tables.

The design deliberately makes identity global:
- A NEAR account maps to one user across every app (unique on `account_id, network`).
- `user.role` is a single global admin flag.
- Personal organizations use `slug = user.id`.

### Queries that legitimately span users

All of these run inside the auth plugin:
- **Orphan sweep.** Every instance runs it every 15 minutes. It deletes orphaned `user` rows and their personal orgs across the whole table (`plugins/auth/src/orphan-sweep.ts`).
- **Admin user listing and org-request approval.** Admin-gated, over all users.
- **Public NEAR profile lookup by account id.**
- **Lookups by hash.** API keys, onboarding codes and device-link claims are found by hash across all rows.
- **NEAR invitation matching.** Joins `near_account` and `invitation` across orgs, then writes `member`/`team_member`.
- **Better Auth adapter calls.** These touch any table and are not individually auditable from here.

## What RLS could protect

| Goal | Can RLS express it? |
|---|---|
| App A can't read app B's users | **No.** There is no app column, and users are shared across apps by design. |
| A request only sees its own user's rows | **Not today.** It would need `SET LOCAL app.user_id` inside a per-request transaction. The pool has no per-request transaction, and Better Auth's adapter doesn't take a request-scoped `tx` (only 8 call sites use `db.transaction`). A session-level `SET` on pooled connections would leak between requests. |
| Device-link rows are only visible to the matching client | Yes. A fixed per-app setting (`-c app.client_id=…` via the pool's startup options, `driver.ts:60-70`) plus a `client_id` policy would work. Low value. |
| Tooling gets read-only access to some tables | Yes, but GRANTs do this more simply. |
| Secret columns (`relayer_key.encrypted_private_key`, `account.password`, `custody_wallet.encrypted_api_key`) are hidden from non-auth roles | Column GRANTs do this. RLS doesn't help. |

**Policies per table (if it were pursued):**
- **Per-user tables.** `session`, `account`, `passkey`, `apikey` (`reference_id`), `near_account`, `custody_wallet`, the referral tables:
  - `USING (user_id = current_setting('app.user_id', true))`
  - plus a bypass for the sweep, admin and hash-lookup paths.
- **Org tables.** `organization`, `member`, `invitation`, `team`, `team_member`: visible where the user is a member, plus a public read for org discovery.
- **`device_code` / `device_link_claim`:** `client_id = current_setting('app.client_id')`.
- **Global tables.** `verification`, `relayer_key`, `funded_gas_key`, `relayed_transaction`, `onboarding_*`: no user predicate fits. These would be `BYPASSRLS`-only.

Every global query listed above would need `BYPASSRLS` or a `SECURITY DEFINER` function. That is most of what the auth plugin does.

## Why it doesn't fit now

1. **Owners bypass RLS.** The runtime role owns the tables because it runs DDL at boot. Owners skip policies unless `FORCE ROW LEVEL SECURITY` is set, and a superuser (what local compose uses) skips them regardless. RLS only means something after migrations and runtime use different roles.
2. **No session context.** Per-user policies need request-scoped transactions threaded through Better Auth's adapter. That means forking or wrapping the adapter. Upstream already lists request-scoped DB access as a prerequisite for schema-per-tenant (`packages/everything-dev/skills/api-and-auth/SKILL.md:403-407`).
3. **No tenant discriminator.** Adding `app_id` to `user` or `near_account` would contradict one global identity per NEAR account and ADR 0013.
4. **Failure is global.** Policies would ship as framework migrations run at boot by every app image. A policy that is too strict breaks sign-in for every app sharing the DB at once. Apps on different pinned images already risk schema skew, because the newest image migrates for everyone.
5. **Dev doesn't exercise it.** Dev uses PGlite, which runs as a single superuser, so policies would only be tested in staging.

## Effect on the everything-dev auth plugin

Everything here is framework-owned (`plugins/auth`, `packages/everything-dev/src/db`), so each item is an upstream issue, not a local edit:
- RLS would need request-scoped transactions and a way to pass a context setting through Better Auth's drizzle adapter. That's a large change to a hot path.
- Scoped roles need only a smaller hook: run migrations with a different URL (an owner role) from the one used at runtime.

## Migration risk

| Option | Risk | Rollback |
|---|---|---|
| Turn on RLS with policies | High. Fails closed across all apps; Better Auth's queries are hard to enumerate; needs adapter changes. | `ALTER TABLE … DISABLE ROW LEVEL SECURITY`, but only after an outage has shown the problem. |
| Separate migrator and runtime roles | Low to medium. Needs an upstream migrate-URL hook, a one-time `ALTER … OWNER`, and GRANTs. A missed GRANT fails loudly at boot or on first use. | Point the runtime URL back at the owner role. |
| Read-only role for tooling | Low. New role, GRANTs only, nothing in the app changes. | Drop the role. |
| Require `AUTH_DATABASE_URL` in prod | Low. Boot fails if it's unset, which is the point. | Revert the check. |

## Recommendation

Keep RLS off. Rely on plugin-surface isolation (ADR 0033: only the auth plugin talks to the auth DB) and do the following:

1. **Separate migrator and runtime roles.** The migrator owns the schema. The auth runtime role gets DML only on the auth tables, with no DDL and no superuser. Upstream: a `AUTH_MIGRATE_DATABASE_URL` (or similar) used only by `runMigrations`.
2. **Read-only tooling role.** `SELECT` on the specific columns scripts need, for example `near_account(user_id, account_id, is_primary)`. Point `audit-credits-eligibility.ts` at it instead of the full auth URL.
3. **Network controls.** Private networking only, with no public proxy URL for the auth DB. One credential per app, so each can be revoked and audited separately, even though Postgres can't tell their rows apart.
4. **Fail closed on config.** In production, refuse to boot when `AUTH_DATABASE_URL` is missing rather than falling back to `API_DATABASE_URL`.
5. **Fix what a shared DB actually changes.** These matter more than RLS:
   - `user.role = admin` is global, so an admin in one app is an admin in every app sharing the DB. Document this, or scope admin per app.
   - Every instance runs the orphan sweep. Elect one instance or take an advisory lock.
   - `relayer_key` has no unique constraint on `network`.
   - `passkey` rows don't record their rpID.
6. **Cross-domain apps.** For apps on other domains, prefer ADR 0027's own answer: OAuth 2.1 against one auth deployment instead of giving more processes DB credentials.

Revisit RLS only if two things land upstream: request-scoped DB access, which the schema-per-tenant plan also needs, and a real tenant discriminator.

## Open question

Production env values weren't visible for this exploration. Before filing upstream, confirm which apps actually share the production auth Postgres and which role each connects as.

## Proposed upstream issues (everything-dev, not filed)

1. Separate migration and runtime database roles for plugin databases (starting with auth)
2. Fail boot in production when `AUTH_DATABASE_URL` is missing instead of falling back to `API_DATABASE_URL`
3. Run the auth orphan sweep on one instance when several apps share an auth database
4. Document, or scope, the global admin role on a shared auth database
5. Unique `relayer_key.network`; record rpID on `passkey`
