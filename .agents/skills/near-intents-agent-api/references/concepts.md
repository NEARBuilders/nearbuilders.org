# Concepts

## The problem it solves

An AI agent that pays, swaps or withdraws needs money it can move without asking a human each
time, but the human must stay in control and the integrating app must not hold the owner's key.
The API splits that into three roles:

- **Owner** — the human who owns the funds. Their wallet signs the account's rules and every
  change to them. The API and the partner never hold the owner's key.
- **Agent account** — one wallet on NEAR Intents per agent, run by the wallet provider
  (a TEE-backed signer). Funds sit there. It moves money only inside the owner-signed
  policy.
- **Partner** — your backend. It holds the `naa_` API key, prepares owner actions, stores grant
  tokens and calls executions for its agents.

## Account, policy, grant

```
agent account (1 per agent)
├── owner         one wallet: NEAR | EVM | passkey   (fixed at creation, no rotation)
├── policy        ONE complete, owner-signed rulebook: WHAT may happen
│   actions, assets, limits, destinations, USD budget, timelock, approval, frozen
└── grants        0..50 live grants: WHO may act
    each = { grant_id, label, expires_at, sha256(token) }  — token held by the partner
```

- **Policy = what.** Shared by every grant. Turning on `withdraw` or adding a destination is one
  owner signature and every grant can use it immediately. There are no per-grant limits; all
  grants draw on the same limits and USD budget.
- **Grant = who.** A bearer credential (`ngt_…`) for one session, assistant, bot or device.
  It carries identity and expiry only. Revoke it to cut off that one actor.
- **Freeze** stops everyone (policy `frozen: true`) and takes effect at once.

When an execution is refused, the error code names the layer that refused it, and only that
layer can lift it:

| Code | Layer | Who fixes it |
|---|---|---|
| `agent_grant_required` | grant (missing, revoked, expired, wrong agent) | issue a grant / use the right token |
| `wallet_frozen` | policy `frozen` | owner `agent_unfreeze` |
| `policy_action_denied` | policy `actions` / `confidential` | owner `policy_update` |
| `policy_destination_denied` | policy `destinations` | owner `policy_update` |
| `spend_budget_exceeded` | policy `budget` (USD, shared) | owner raises cap, or wait for the window |
| `policy_schedule_denied` | policy `schedule` (owner's weekly hours) | submit again at `meta.available_at`, or owner changes `schedule` |
| `policy_denied` | provider-enforced policy (assets, per-asset limits, rate, …) | owner `policy_update` |
| `policy_not_ready` | latest policy not yet in force | wait for the pending policy intent |

A bigger USD budget never lifts a per-asset limit and a new grant never lifts a policy rule.

## Who enforces what

| Policy field | Enforced by | Changing only these needs |
|---|---|---|
| `destinations`, `budget`, `timelock_ms`, `schedule` | the API, before dispatch | one **off-chain** signature (`nep413`/`eip712`/`webauthn`), no transaction |
| `frozen`, `actions`, `confidential`, `owner_approval`, `assets`, `limits`, `max_actions_per_hour` | the wallet provider, on chain | one **on-chain** signature (`nep366` for NEAR owners; EVM/passkey sign `eip712`/`webauthn` and the API sponsors the call) |

The API picks which, based on what changed; you just sign whatever `intent.standard` says.
A policy is in force only when `GET …/policy` shows `status: "APPLIED"` and
`provider_policy_synced: true`.

## Two kinds of writes

| | Owner intents | Executions |
|---|---|---|
| Endpoints | `POST /v1/generate-intent` → wallet signs → `POST /v1/submit-intent` | `POST /v1/agents/{id}/swap|withdraw|transfer|shield|unshield|deposit` |
| Authorized by | owner's signature on that exact payload | `X-Grant-Token` + the policy (deposit: API key only) |
| Ids | `intent_…` | `op_…` |
| Retry safety | resubmitting the same signature is idempotent | `Idempotency-Key` |

Both return a `correlation_id`; `GET /v1/status?correlation_id=` reads either.

## Execution pipeline

1. **Authorize** — grant live, not frozen, action/asset/limits/destination/budget allowed, and
   the `schedule` open at the moment it would run (now + `timelock_ms`).
   Refusal = error response, nothing recorded.
2. **Wait** — `timelock_ms > 0` → `QUEUED` until `execute_after` (owner may `execution_cancel`).
   `owner_approval` → `PENDING_APPROVAL` until the owner's `approval_vote`. An `approve`
   re-runs step 1 (grant live, not frozen, destination allowed; not the schedule) before the
   release and refuses the vote when it fails; a `reject` releases the budget charge. A release
   outside the `schedule` fails the operation; nothing is sent.
3. **Dispatch commit** — the `schedule` is checked once more, then `dispatch_committed_at` is
   set and the request goes to the provider.
   From here, revoking the grant/key or freezing does **not** stop this operation.
4. **Settle** — `PROCESSING` → `SUCCESS` | `REFUNDED` | `FAILED`, or `UNCERTAIN` /
   `NEEDS_REVIEW` when the outcome cannot be proven.

## Owners

- **NEAR**: a named account (`alice.near`) and one of its **FullAccess** ed25519 keys. Signs
  `nep366` (on-chain changes, gasless: the API's sponsor pays) and `nep413` (off-chain).
- **EVM**: any secp256k1 EOA (MetaMask, Rabby, a KMS key). The API derives a deterministic NEAR
  account from the public key and deploys it on first use, sponsored. Signs `eip712`. No
  EIP-1271 contract wallets. **Off by default for new agents** while the EVM wallet build is a
  pre-release: a deployment without it answers `owner_type_unsupported` and leaves `evm` out of
  `supported_owner_types` on `GET /v1/network`. Existing EVM-owned agents keep working.
- **Passkey**: WebAuthn ES256 credential; also gets a derived NEAR account. Signs `webauthn` in
  the browser only.

The owner is fixed for the account's life: no key rotation, no recovery, no transfer of
ownership. Pick the owner type deliberately. Every owner type can use `owner_approval` and vote
with `approval_vote`; EVM and passkey votes are confirmed by the owner's `0s` wallet.

## Money and assets

- Assets are NEAR Intents assets identified by `asset_id` (`nep141:…`, `nep245:…`) from
  `GET /v1/tokens`. Balances are per asset inside the agent's NEAR Intents account.
- **Public** balance is normal. **Confidential** balance is shielded (requires policy
  `confidential: true`); `shield`/`unshield` move between them; `confidential: true` on
  swap/withdraw/transfer spends from it.
- **Deposits** come in through 1Click deposit addresses on any supported chain, or directly on
  NEAR. Deposits never need a grant and are always allowed.
- **Withdrawals** leave NEAR Intents to an external chain address. **Transfers** go to another
  NEAR Intents account (no bridge).
- Swaps and withdrawals route through 1Click; `dry: true` returns its quote.

## Lifecycle states

`AgentView.status`: `PENDING` (created, not yet signed) → `ACTIVE`; `ARCHIVED` (hidden, nothing
changes on chain); `DELETED`; `ABANDONED` (creation expired or failed, never usable).

## Cooldowns

- Ordinary policy change: next one allowed 5 minutes after the last (per agent) →
  `policy_change_throttled` (429, `meta.available_at`). Creating the account does not start it.
- Pure `agent_freeze` is never throttled (it is the emergency brake).
- `agent_unfreeze` has its own cooldown: an unfreeze is allowed 5 minutes after the previous
  unfreeze → `agent_unfreeze_throttled`. So a freeze right after an unfreeze can leave the
  account frozen for up to 5 minutes; check before freezing in tests and demos.
- `GET /v1/agents/{id}` → `cooldowns.policy_change_available_at` / `unfreeze_available_at` tell
  you before you ask the owner to sign.
