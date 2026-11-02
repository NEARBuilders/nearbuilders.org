# Identity-keying audit: nearbuilders.org

Issue: #329. Audited at `bd322ed` (origin/main, 31 Oct). Next in the audit order: feedback.nearbuilders.org (#224), then activity.nearbuilders.org.

## Convention checked against

- Canonical owner id: `context.near.primaryAccountId ?? userId`.
- Ownership, nomination and "is this mine" checks fan out over the primary account **plus every linked account** (`context.near.linkedAccounts`).
- App tables store a NEAR-account key (`nearAccount` or equivalent) next to a **nullable** `userId`. `builders` is the reference shape.
- No app code reads the auth DB (`near_accounts`, `is_primary`). Identity comes from the auth plugin context only.
- Nothing is keyed on a session id.

## Severity scale

| Severity | Meaning |
| --- | --- |
| High | Rows keyed only on the internal auth `userId`, with no NEAR-account sibling. They orphan if user ids change when the shared auth DB lands, and need a backfill. |
| Medium | Rows carry a NEAR account, but the read or ownership path checks only the primary account (or the primary plus the bare `userId`). After the user links accounts or changes primary, they lose access to their own data. These are read-path fixes, mostly with no migration. |
| Low | Naming or shape drift (a "userId" column that actually holds an account id, a `userId` that is `NOT NULL`, an audit actor recorded as the bare `userId`), or ops tooling outside the request path. |

## Summary

- **Session ids: none.** No schema column, write path or ownership check uses a session id. `context.userId` is the auth user id, not the session. The acceptance criterion "no write path can key new data on session id" holds today. A follow-up ticket proposes a guard test so it stays true.
- **High (3):** `upvotes`, `bookmarks` and the Telegram reviewer tables are keyed only on the internal `userId`.
- **Medium (6):** `projects` and `events` ownership, the proposal creator checks, notifications, credit status and the builder "my profile" lookup all check only the primary account, never the linked ones.
- **Low (5):** polymorphic owner columns, misnamed columns, a `NOT NULL` userId, audit actors recorded as `userId`, and the credits eligibility script, which reads the auth DB directly.
- **Already compliant:** `builders`, `builder_nominations` (submitted account plus user), `nearcatalog_claims` and history, `activity_events.actor`, `credit_claims` (both keys present), builder nominations through the API (fan out over linked accounts), and `getMySubmission` (fans out over linked accounts).

## Schema inventory

Every column that references a user. "Key" is what the value actually holds at write time.

| Table.column | Holds | NEAR key? | Nullable userId? | Verdict |
| --- | --- | --- | --- | --- |
| `builders.near_account` / `user_id` (`plugins/builders/src/db/schema.ts:17-18`) | primary account / auth user | yes | yes | OK (reference shape) |
| `builder_nominations.submitted_near_account` / `submitted_user_id` (`plugins/builders/src/db/schema.ts:76-77`) | account / auth user | yes | yes | OK |
| `builder_nominations.updated_by` (`plugins/builders/src/db/schema.ts:70`) | admin auth user id (`plugins/builders/src/services/nominations.ts:652`) | no | yes | Low (L4) |
| `builder_nominations.nominated_by_telegram_id`, `nominator_x_id`, `created_by_api_key_id` | external ids / API key | n/a | n/a | OK (not auth users) |
| `builder_x_identities.builder_id` (`plugins/builders/src/db/schema.ts:102`) | builder row id → `near_account` | via builder | n/a | OK |
| `credit_claims.near_account_id` / `user_id` (`plugins/credits/src/db/schema.ts:17-18`) | primary account / auth user | yes | **NOT NULL** | Low (L3); read path is M5 |
| `credits_settings.updated_by` (`plugins/credits/src/db/schema.ts:52`) | admin id | no | yes | Low (L4) |
| `nearai_sessions.id` (`plugins/credits/src/db/schema.ts:38`) | service login to NEAR AI, not a user session | n/a | n/a | OK (not user-keyed) |
| `nearcatalog_claims.near_account`, `nearcatalog_claim_history.near_account` (`plugins/nearcatalog/src/db/schema.ts:7,31`) | account | yes | no userId | OK |
| `activity_events.actor`, `activity_gateway_outbox.actor` (`plugins/activity/src/db/schema.ts:18,51`) | primary account (`plugins/activity/src/index.ts:168,245`) | yes | no userId | OK |
| `projects.owner_id` (`plugins/projects/src/db/schema.ts:8`) | `primaryAccountId ?? userId` | usually | single column | Low (L1); read path is M1 |
| `project_apps.account_id` / `created_by_user_id` (`plugins/projects/src/db/schema.ts:37,39`) | app account / owner id (account) | yes | misnamed | Low (L2) |
| `project_collaborators.collaborator_owner_id` / `invited_by_user_id` (`plugins/projects/src/db/schema.ts:52,55`) | invited account / inviter owner id (`plugins/projects/src/services/projects.ts:1010,1486`) | yes | misnamed | Low (L2); read path is M1 |
| `project_mentions.target_owner_id` (`plugins/projects/src/db/schema.ts:74`) | owner id parsed from content | usually | n/a | OK |
| `events.owner_id` (`plugins/events/src/db/schema.ts:7`) | `primaryAccountId ?? userId` | usually | single column | Low (L1); read path is M2 |
| `event_participants.user_id` / `wallet_address` (`plugins/events/src/db/schema.ts:34-35`) | `primaryAccountId ?? userId` / primary account (`plugins/events/src/index.ts:198-199`) | yes (`wallet_address`) | misnamed, NOT NULL | Low (L1, L2); read path is M2 |
| `proposals.created_by` (`plugins/proposals/src/db/schema.ts:12`) | `primaryAccountId ?? userId ?? apiKey.id` (`plugins/proposals/src/index.ts:177-178`) | usually | single column | Low (L1); read path is M3 |
| `proposal_submissions.submitted_by` (`plugins/proposals/src/db/schema.ts:45`) | same as above | usually | single column | OK (read path fans out) |
| `proposal_audit_log.actor` (`plugins/proposals/src/db/schema.ts:69`) | creator owner id on submit, **bare `userId`** on review actions (`plugins/proposals/src/index.ts:194,205,219`) | mixed | n/a | Low (L4) |
| `notifications.user_id` (`plugins/notifications/src/db/schema.ts:7`) | recipient account; the API rewrites `context.userId` to `primaryAccountId ?? userId` before calling (`api/src/index.ts:103-107`) | usually | misnamed | Low (L2); read path is M4 |
| `upvotes.user_id` (`plugins/votes/src/db/schema.ts:8`) | **bare auth `userId`** | **no** | NOT NULL | **High (H1)** |
| `bookmarks.user_id` (`plugins/bookmarks/src/db/schema.ts:8`) | **bare auth `userId`** | **no** | NOT NULL | **High (H2)** |
| `telegram_link_codes.user_id`, `telegram_reviewers.user_id` (`plugins/proposals/src/db/schema.ts:119,131`) | **bare auth `userId`** (`api/src/services/telegram-link.ts:39`) | **no** | NOT NULL | **High (H3)** |
| `review_leases.holder` (`plugins/proposals/src/db/schema.ts:113`) | process/worker id | n/a | n/a | OK (not user-keyed) |

`api/src/db/schema.ts` is empty, so the host has no tables of its own.

## Findings

### H1. Upvotes are keyed on the bare auth userId (High)

- Schema: `plugins/votes/src/db/schema.ts:8`, unique `(thing_id, user_id)` at `:11`.
- Writes and reads: `plugins/votes/src/index.ts:37,41,49,53` use `context.userId`. The API passes the raw context through (`api/src/index.ts:887-903`).
- Impact: upvotes are also the nomination endorsement count (`api/src/index.ts:395`). If user ids are reissued when the shared auth DB lands, every existing vote orphans: the user's "voted" state is lost and they can vote again on the same entity, which inflates counts. Two auth users later merged into one keep two votes.
- Fix: add `near_account` (from `primaryAccountId`), keep `user_id` nullable, and move the unique key to `(thing_id, near_account)`. Check "did I vote" across primary plus linked accounts. Backfill `near_account` from the auth plugin (admin endpoint, not a direct DB read) and dedupe rows that collapse onto one account.

### H2. Bookmarks are keyed on the bare auth userId (High)

- Schema: `plugins/bookmarks/src/db/schema.ts:8`, unique `(entity_id, user_id)` at `:11`.
- Writes and reads: `plugins/bookmarks/src/index.ts:37,41,49`, via `api/src/index.ts:922-932`.
- Impact: same orphaning as H1, but lower stakes (personal state, no shared counts). It is still High because it needs a backfill to survive.
- Fix: same shape as H1.

### H3. Telegram reviewer links are keyed on the bare auth userId (High, admin-only)

- Schema: `plugins/proposals/src/db/schema.ts:117-136`. `telegram_reviewers.user_id` is unique at `:135`.
- Write: `api/src/services/telegram-link.ts:33-40` stores `context.userId`. Read: `api/src/services/telegram-review.ts:40-56` builds a synthetic admin context with `userId = reviewer.userId` and `near: undefined`, so every action taken from Telegram records the bare user id as actor.
- Impact: a handful of admin rows, but if user ids change, Telegram review stops resolving to the right admin and the audit trail mixes ids. The synthetic context also drops the admin's NEAR account, so the owner-id convention can't be applied downstream.
- Fix: store the admin's primary account next to a nullable `user_id`. Rebuild the context with `near.primaryAccountId` set. Re-linking the few reviewers by hand is cheaper than a backfill.

### M1. Project ownership checks the primary account plus the bare userId, never linked accounts (Medium)

- `plugins/projects/src/index.ts:79-85` (`getAlternateOwnerId`) and every handler at `:94-408` pass `primaryAccountId ?? userId` plus the bare `userId` as the alternate.
- `plugins/projects/src/services/projects.ts:453-455` (`isProjectOwner`), `:241-270` (collaborator check) and `:662-663` compare against those two values only.
- Impact: a project created while account A was primary becomes uneditable when the user switches primary to linked account B. Collaborator invites sent to a linked account never match.
- Fix: pass the full owner set (`[primary, ...linked, userId]`) and use `inArray` everywhere these helpers compare. No migration needed.

### M2. Event ownership and participation have the same gap (Medium)

- `plugins/events/src/index.ts:68-74` and handlers at `:118-294`. `plugins/events/src/services/events.ts:58-60` (`isOwner`), `:277-291` (participant and viewable conditions).
- Impact and fix: same as M1. A participant row joined under the old primary isn't found, so the user can join twice under the new one (the unique `(event_id, user_id)` at `plugins/events/src/db/schema.ts:45` doesn't catch it).

### M3. Proposal creator checks use only the primary account (Medium)

- `plugins/proposals/src/index.ts:124-125` (`viewerId`) feeds visibility of private-plugin proposals (`plugins/proposals/src/services/proposals.ts:1199-1206`, `eq(proposals.createdBy, input.viewerId)`).
- Withdraw: `plugins/proposals/src/index.ts:240-242` compares `createdBy !== viewer`, and `isSubject` checks only `primaryAccountId`.
- Impact: after a primary switch the user can't see or withdraw their own private-plugin proposals, and can't withdraw a nomination that targets one of their linked accounts. `getMySubmission` at `:347-361` already fans out correctly and is the pattern to copy.
- Fix: read-path only. Turn `viewerId` into an id set and use `inArray`.

### M4. Notifications are addressed to one account and read back with one id (Medium)

- Recipients are stored by account: `api/src/services/proposal-notifications.ts:26-186` (`proposal.createdBy`) and `api/src/index.ts:1148` (`collaboratorOwnerId`).
- Reads use the rewritten `context.userId` (= `primaryAccountId ?? userId`, `api/src/index.ts:103-107`) and match it exactly: `plugins/notifications/src/index.ts:82,87,93,102`.
- Impact: notifications addressed to a linked account, or to the old primary, never show up. A user without a NEAR account and a user with one get ids from different namespaces in the same column.
- Fix: pass the owner set through the context and query with `inArray`. Optionally add an explicit `recipient_account` column (L2).

### M5. Credit status is looked up by the current primary only (Medium)

- `plugins/credits/src/index.ts:61-68` resolves `primaryAccountId` only. `plugins/credits/src/services/credits.ts:254-256` finds the claim by that account.
- Impact: after a primary switch the claim card shows "not claimed", and a new claim then fails on the unique `user_id` index (`plugins/credits/src/db/schema.ts:33`) with a confusing error. Eligibility is also checked against the new primary's builder profile only.
- Fix: look the claim up by any of `[primary, ...linked]` or by `userId`. No migration.

### M6. "My builder profile" picks an arbitrary row (Medium)

- `plugins/builders/src/services/builders.ts:527-541` (`getBuilderByUserId`) matches `near_account = primary OR user_id = userId` with `LIMIT 1` and no ordering. Callers: `plugins/builders/src/index.ts:282,336`.
- Impact: a user who has builder rows for two of their accounts gets a nondeterministic one, and linked-account profiles are never found by account. Credits eligibility (M5) depends on this lookup.
- Fix: match `near_account IN (primary, ...linked)` and prefer the primary row in the `ORDER BY`. No migration.

### L1. Polymorphic single-column owner ids (Low)

`projects.owner_id`, `events.owner_id`, `event_participants.user_id` and `proposals.created_by` store `primaryAccountId ?? userId` (and `?? apiKey.id` for proposals) in one column. That is the convention, but nothing marks which namespace a row is in. A user who later links NEAR keeps rows under the internal id. Fix: when a user first links a NEAR account, re-key their rows from `userId` to the account (a small backfill per table), or add a `kind` marker. Can be folded into M1–M3.

### L2. Columns named "userId" that hold account ids (Low)

`notifications.user_id`, `event_participants.user_id`, `project_apps.created_by_user_id` and `project_collaborators.invited_by_user_id` hold owner/account ids, not auth user ids. This misleads future readers and makes it easy to write a check that compares against the wrong id. Fix: rename in contracts or document it. Rename migrations are optional.

### L3. `credit_claims.user_id` is NOT NULL (Low)

`plugins/credits/src/db/schema.ts:18`. The convention wants `userId` nullable next to the account key. Harmless today because every claim has a session user. Relax it when the auth DB moves.

### L4. Admin and audit actors recorded as the bare userId (Low)

`proposal_audit_log.actor` on review actions (`plugins/proposals/src/index.ts:194,205,219`), `builder_nominations.updated_by` (`plugins/builders/src/services/nominations.ts:652`) and `credits_settings.updated_by`. History only, never used for authorization, but the ids won't resolve after the auth DB moves. Fix: record `primaryAccountId ?? userId` going forward. No backfill needed.

### L5. The credits eligibility script reads the auth DB directly (Low)

`plugins/credits/scripts/audit-credits-eligibility.ts:82-131` connects with `AUTH_DATABASE_URL` and discovers the `near_accounts` table by regex. It is a manual, read-only ops script and not in the request path, but it breaks the "nothing reads the auth DB" rule and will break when the auth DB moves. Fix: switch it to an admin endpoint on the auth plugin, or mark it deprecated once the shared DB lands.

## Not findings (checked)

- Builder self-profile writes key on `primaryAccountId` and store `userId` alongside (`plugins/builders/src/index.ts:181,202`).
- Nominating a builder blocks self-nomination across primary plus linked accounts (`api/src/index.ts:367-385`).
- The catalog claim approval writes `near_account` from the proposal entity (`api/src/services/catalog-claims.ts:64,86`).
- Apps sender checks use `primaryAccountId` (`plugins/apps/src/index.ts:43,125,183`). Apps hold no user-keyed table.
- The UI resolves accounts only through the auth client (`ui/src/hooks/use-near-account.ts`, `ui/src/lib/queries/near-accounts.ts`). No direct auth DB access.

## Proposed fix tickets

Not filed. The user decides which to open.

| # | Title | Severity | Migration / backfill |
| --- | --- | --- | --- |
| 1 | votes: key upvotes on NEAR account (nullable userId) and fan out "did I vote" over linked accounts | High | Yes: add `near_account`, backfill from the auth plugin, dedupe, move the unique index |
| 2 | bookmarks: key on NEAR account with nullable userId | High | Yes: same as #1 |
| 3 | telegram review: store the reviewer's NEAR account and set `near` in the synthetic reviewer context | High | Small: add a column; re-link the few reviewers by hand instead of backfilling |
| 4 | projects + events: shared owner-id-set helper (`primary + linked + userId`) for ownership, collaborator and participant checks | Medium | No (read path) |
| 5 | proposals: fan out viewer and creator checks (visibility, withdraw, isSubject) over linked accounts | Medium | No |
| 6 | notifications: read and mark-read over the caller's owner-id set | Medium | No (optional `recipient_account` rename) |
| 7 | credits + builders: find claim and builder profile across linked accounts, deterministic primary-first | Medium | No |
| 8 | Re-key `userId`-namespaced owner rows when a user first links NEAR (projects, events, proposals) | Low | Yes: small per-table backfill |
| 9 | Record audit/admin actors as `primaryAccountId ?? userId`; rename misleading `*_user_id` columns | Low | Optional rename migration |
| 10 | credits eligibility script: stop reading the auth DB directly | Low | No |
| 11 | Guard test: fail if any plugin schema adds a `session_id`-style column or a handler reads `context.session` for keying | Low | No |
