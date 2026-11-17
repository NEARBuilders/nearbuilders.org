# Designing an integration

## Reference architecture

```
┌──────────── browser / app ────────────┐        ┌──────────── your backend ────────────┐        ┌── NEAR Intents Agent API ──┐
│ owner wallet (NEAR/EVM/passkey)       │        │ naa_ key (secret store)              │        │ api.agentsonintents.com   │
│ shows preview, signs intent.payload   │◄──────►│ BFF routes: generate / submit / read │◄──────►│ policy, grants, dispatch  │
│ never sees naa_ / ngt_                │        │ grant tokens (encrypted)             │        │ → agent wallet, 1Click   │
└───────────────────────────────────────┘        │ AI agent runtime / tools             │        └───────────────────────────┘
                                                 │ jobs: status poller, network watch   │
                                                 └──────────────────────────────────────┘
```

The API never sees owner keys; the browser never sees API keys or grant tokens; the AI model
never sees either.

## What to persist

| Table | Columns | Why |
|---|---|---|
| `agent_accounts` | `agent_id`, `user_id`, `name`, `owner_type`, `owner_descriptor`, `created_at` | map users ↔ agents (also send `external_user_id`) |
| `owner_intents` | `correlation_id`, `type`, `agent_id`, `user_id`, `status`, `expires_at` | BFF authorization for submit; UI state |
| `grants` | `grant_id`, `agent_id`, `label`, `token_ciphertext`, `expires_at`, `revoked_at`, `actor` (session/bot id) | the agent's credential; one per actor |
| `operations` | `correlation_id`, `agent_id`, `grant_id`, `action`, `idempotency_key`, `request_body`, `status`, `failure_code`, `created_at`, `updated_at` | idempotent retries, recovery, activity feed |

Write the `operations` row (key + body) **before** the HTTP call; update it from responses and
the poller. The API is the source of truth; your table is a cache plus your retry ledger.

## Background jobs

- **Status poller**: for rows not in a terminal state, `GET /v1/status?wait_ms=…` with bounded
  concurrency (≤10 long-polls per key). Skip `NEEDS_REVIEW` (alert instead).
- **Network watch**: `GET /v1/network` every minute; show degraded components in your UI and
  pause automated agents when `custody` or `one_click` is `down`.
- **Grant hygiene**: revoke grants of ended sessions; rotate long-lived ones.

## Key ownership models

| Model | Owner key held by | Use when | Notes |
|---|---|---|---|
| **User-owned key** (recommended) | the end user's wallet | consumer apps, wallets, AI assistants | user signs in the browser; you never touch the key |
| **Company-as-owner** | your company (KMS/HSM key, EVM recommended) | treasury bots, B2B automation, internal agents | sign `eip712` digests with KMS; you hold that key and control its approvals; add your own approvals around it |
| **Passkey owner** | user's authenticator | mobile/web without crypto wallets | needs your WebAuthn registration flow; no owner approval votes |

With company-as-owner, the policy still bounds the agent, so a compromised agent runtime cannot
exceed it; protect the owner key separately from the runtime that holds grant tokens.

## Multi-tenant SaaS

- One API key per environment; tag every agent with `external_user_id` = your user id and
  filter with `GET /v1/agents?external_user_id=`.
- Enforce in your BFF that a user can only generate/submit for their own agents and intents.
- Default limits: 100 agents / 24 h per tenant, 100 deposit addresses / 24 h per agent; plan onboarding
  bursts accordingly (`/v1/quotas`).

## AI agent tool design

Expose a small, safe tool surface to the model; your backend maps tools to API calls with the
grant of that conversation.

| Tool | API | Notes |
|---|---|---|
| `get_balances` | `GET …/balances` (public + confidential) | format with `decimals` |
| `get_rules` | `GET …/policy` | summarize actions, destinations, budget remaining, timelock, schedule |
| `list_tokens` | `GET /v1/tokens` | cache; resolve symbols → `asset_id` |
| `quote_swap` / `quote_withdraw` | `dry: true` | always before executing |
| `swap` / `transfer` / `withdraw` | executions | server creates the idempotency key; require explicit user confirmation for amounts above a threshold |
| `deposit_address` | `POST …/deposit` | show address, memo, min amount, expiry |
| `check_operation` | `GET /v1/status` | returns status + hashes |
| `network_status` | `GET /v1/network` | when a route/quote fails |

Do **not** give the model tools for owner intents (policy changes, grants, freeze, delete); those
belong to the owner's UI with a wallet signature. If the model is asked to "raise my limit",
reply with what the owner must sign and link to the UI.

Convert amounts at the boundary: the model speaks decimal ("0.5 NEAR"), the tool converts with
token `decimals` to atomic strings, rejecting more fractional digits than `decimals`.

For MCP servers: run the MCP server on your backend (or a local process for a single user) that
holds the grant token in its environment; one grant per MCP client installation.

## Security checklist

- [ ] `naa_` key only in server secret storage; separate keys per environment; rotate by
      creating a new key, deploying, then revoking the old one.
- [ ] Grant tokens encrypted at rest, never logged, never in prompts, URLs or client bundles.
- [ ] One grant per actor; short expiry for sessions; revoke on logout/uninstall.
- [ ] BFF checks user ↔ agent ↔ correlation_id ownership on every route.
- [ ] Owner sees `preview.summary` + full policy before signing; deletes show `assets_lost`.
- [ ] Default policy is tight: explicit assets, per-transaction limits, `destinations: only`,
      USD budget, and a timelock or owner approval for payouts.
- [ ] Idempotency keys persisted before sending; no new key for `UNCERTAIN`.
- [ ] `NEEDS_REVIEW` alerts a human.
- [ ] Mainnet writes behind explicit configuration flags in dev tooling.
- [ ] Logs carry `request_id` and `correlation_id`, never secrets or signatures.
- [ ] Freeze button available to the owner at all times (no cooldown on freeze).
