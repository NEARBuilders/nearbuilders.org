# Policy

One complete, owner-signed rulebook per agent account. Every grant acts within it. Each
`agent_create` and `policy_update` carries the **whole** policy, never a diff; every field below
is required except `schedule` and `sign`.

```ts
Policy = {
  frozen: boolean,
  actions: ("swap" | "transfer" | "withdraw")[],          // unique; deposits are always allowed
  confidential: boolean,                                  // shield/unshield + confidential form of each action
  owner_approval: boolean,                                // every outgoing money action waits for the owner's vote
  assets: "any" | string[],                               // asset_id values, ≤128
  limits: {                                               // per-asset caps, atomic strings (1–78 digits)
    per_transaction?: Record<asset_id, string>,
    hourly?:          Record<asset_id, string>,
    daily?:           Record<asset_id, string>,
    monthly?:         Record<asset_id, string>,
  },
  max_actions_per_hour: number | null,                    // positive int ≤ 1_000_000, null = no cap
  destinations: { mode: "only" | "except" | "any", list: Destination[] },   // list ≤256; "any" ⇒ []
  budget: { daily_usd: string | null, weekly_usd: string | null, monthly_usd: string | null },
  timelock_ms: number,                                    // 0 … 2_592_000_000 (30 days)
  schedule?: Schedule,                                    // omit = money actions may run any time
  sign?: { recipients: string[] }                         // omit = the agent signs nothing; 1–256 NEAR accounts
}

Destination =
  | { action: "withdraw", chain: string, address: string, memo: string | null }   // external chain address
  | { action: "transfer", address: string, confidential: boolean }                // NEAR Intents account

Schedule = {
  mode: "only" | "except",                                // run only inside the windows, or pause inside them
  time_zone: string,                                      // IANA zone, e.g. "Europe/Berlin", "UTC"
  windows: {                                              // 1 … 28
    days: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[],   // unique, 1 … 7
    start: string,                                        // "HH:MM", 24-hour, inclusive
    end: string,                                          // "HH:MM" or "24:00", exclusive, ≠ start
  }[]
}
```

Unknown fields are rejected (strict objects). Field names are snake_case.

## Field by field

| Field | Effect | Enforced by |
|---|---|---|
| `frozen` | kill switch: every money action refused (`wallet_frozen`). Use `agent_freeze`/`agent_unfreeze` intents, not a policy edit | provider |
| `actions` | which money actions exist at all. Missing → `policy_action_denied` | provider |
| `confidential` | enables `shield`, `unshield`, and `confidential: true` on swap/withdraw/transfer | provider |
| `owner_approval` | outgoing actions go `PENDING_APPROVAL` until the owner votes; deposits unaffected. Hard limits still reject first | provider |
| `assets` | tokens the agent may spend (`"any"` or explicit ids). Swaps may buy unlisted tokens but not sell them | provider |
| `limits` | per-asset caps per transaction and per rolling hour/day/month. Needs named assets to be meaningful | provider |
| `max_actions_per_hour` | rate cap on money actions regardless of amount | provider |
| `destinations` | where withdrawals/transfers may go | **API** |
| `budget` | total USD value across all assets, rolling 24 h / 7 d / 30 d; shared by every grant | **API** |
| `timelock_ms` | every outgoing money action is `QUEUED` this long; owner can `execution_cancel` | **API** |
| `schedule` | weekly windows on the owner's clock when money actions may run (`only`) or are paused (`except`) | **API** |

`budget` notes: charged atomically at dispatch using 1Click USD prices; an asset with no fresh
price fails with `spend_price_unavailable` (only while a budget is set). A larger budget never
lifts a per-asset limit; both must pass. Live usage is in `GET …/policy` →
`usage.budget.{daily,weekly,monthly}.{limit_usd, spent_usd, remaining_usd, resets_at}`.

`destinations` notes:
- `only` + `[]` (the safe default) keeps funds inside the account: swaps only.
- `only` matches the **exact** entry, memo included. `except` blocks an account under any memo.
- EVM addresses must be canonical lowercase hex; other chains keep their exact case.
- `transfer` entries are NEAR Intents account ids (`alice.near`, implicit hex accounts).

`schedule` notes:
- A window is `start` inclusive, `end` exclusive, in `time_zone`. `00:00`–`24:00` is a whole day.
- An `end` earlier than `start` runs past midnight and belongs to the day it starts on:
  `{"days":["fri"],"start":"22:00","end":"02:00"}` covers Friday night into Saturday morning.
- Daylight saving follows the time zone: a window means the same local hours all year.
- Judged when the action would **run**: at submit for `now + timelock_ms`, again when the timelock
  releases, and again at dispatch. A timelocked action whose release falls outside the schedule
  fails; nothing is sent.
- Refusal: `403 policy_schedule_denied` with `meta.available_at` (next allowed moment) and
  `Retry-After`. Submit again at `available_at` with a **new** `Idempotency-Key`, or the owner
  changes `schedule`. A same-key replay returns the original operation, not a fresh judgement.
- Exempt: deposits, `sign` and owner approval votes.
- Not sent to the provider: a schedule-only edit is an off-chain owner signature.

## Signing (`sign`)

`sign: { recipients: ["login.example.near"] }` lets any grant ask the agent's key to sign an
identity challenge for those NEAR accounts (`POST /v1/agents/{agent_id}/sign`), so the agent can
prove it controls the account, for example to log in to a service. Omit it and nothing is signed.

- Only the canonical `near-intents-agent-api.identity.v1` challenge is signed (exact fields
  `domain, purpose, chain, audience, challenge, issued_at_ms, expires_at_ms`; `audience` =
  `recipient`; lives ≤ 5 minutes). Never a transaction, an intent or free text.
- `intents.near` and `intents.far` (the NEAR Intents contracts) are never recipients: the policy is
  refused with `validation_failed`, a request with `403 signing_recipient_forbidden`.
- Moves no value: `timelock_ms`, `schedule`, `budget` and `owner_approval` do not apply.
- Off unless the owner adds it. Warn the owner before signing it: a listed service may treat the
  signature as the account logging in, so list only trusted services.
- Changing `sign` is an on-chain policy update (the wallet provider enforces the same list).

## Ready-made policies

**Swap-only trading assistant** (funds never leave the account):

```json
{
  "frozen": false, "actions": ["swap"], "confidential": false, "owner_approval": false,
  "assets": ["nep141:wrap.near", "<usdc asset_id>"],
  "limits": { "per_transaction": { "nep141:wrap.near": "10000000000000000000000000" } },
  "max_actions_per_hour": 30,
  "destinations": { "mode": "only", "list": [] },
  "budget": { "daily_usd": "100", "weekly_usd": null, "monthly_usd": "1000" },
  "timelock_ms": 0
}
```

**Payroll / payouts to an allow-list with a review window**:

```json
{
  "frozen": false, "actions": ["transfer", "withdraw"], "confidential": false, "owner_approval": false,
  "assets": ["<usdc asset_id>"],
  "limits": { "per_transaction": { "<usdc asset_id>": "500000000" }, "daily": { "<usdc asset_id>": "2000000000" } },
  "max_actions_per_hour": 10,
  "destinations": { "mode": "only", "list": [
    { "action": "transfer", "address": "vendor.near", "confidential": false },
    { "action": "withdraw", "chain": "base", "address": "0xabc…", "memo": null }
  ] },
  "budget": { "daily_usd": "2000", "weekly_usd": "5000", "monthly_usd": null },
  "timelock_ms": 3600000
}
```

**Business hours only** (any policy plus a schedule; here Mon–Fri 09:00–17:00 Berlin time):

```json
"schedule": {
  "mode": "only", "time_zone": "Europe/Berlin",
  "windows": [{ "days": ["mon","tue","wed","thu","fri"], "start": "09:00", "end": "17:00" }]
}
```

Pause overnight instead: `{"mode":"except","time_zone":"UTC","windows":[{"days":["mon","tue","wed","thu","fri","sat","sun"],"start":"22:00","end":"07:00"}]}`.

**Human-in-the-loop** (any owner type): as above with `"owner_approval": true`.

**Broad, capped by USD**: `"actions": ["swap","transfer","withdraw"]`, `"assets": "any"`,
`"limits": {}`, `"destinations": {"mode":"any","list":[]}`, budget set. Only for owners who
explicitly accept that the agent can send anywhere.

## Changing a policy

1. `view = GET /v1/agents/{id}/policy`. Require `status == "APPLIED"`.
2. Check `GET /v1/agents/{id}` → `cooldowns.policy_change_available_at` is null or past.
3. Build the complete new policy from `view.policy` (to remove a schedule, omit `schedule`).
4. `generate-intent {type: "policy_update", agent_id, policy, expected_revision: view.revision}`.
5. Owner signs (`nep413`/`eip712` when only API-enforced fields changed, otherwise on chain).
6. Submit, wait `SUCCESS`, then poll `GET …/policy` until `APPLIED` and
   `provider_policy_synced: true`. Until then executions fail with `policy_not_ready`.

Cooldowns (per agent, default 5 minutes):
- any ordinary change (anything other than a pure freeze/unfreeze) → next ordinary change waits
  → `policy_change_throttled` with `meta.available_at`;
- `agent_freeze` is never throttled;
- an unfreeze waits 5 minutes after the previous unfreeze → `agent_unfreeze_throttled`;
- `agent_create` does not start a cooldown, so a freshly created agent can be edited at once.

Plan UX around it: batch edits into one signature, and show `available_at` instead of a
generic error.

## Validation errors

A malformed policy returns `400 validation_failed` with one error per field
(`source.pointer` like `/policy/destinations/list/0/address`). Other policy-related codes:
`policy_revision_conflict`, `policy_reconciliation_required`,
`policy_blocks_delete` (an old-shape policy must be re-signed before deletion).
