---
name: near-intents-agent-api
description: Build on the NEAR Intents Agent API (api.agentsonintents.com) in any language — TypeScript, Python, Rust, Go or plain HTTP. Use when integrating AI-agent wallets on NEAR Intents into an app or backend, when code mentions `naa_` API keys, `ngt_` grant tokens, `X-Grant-Token`, `generate-intent`/`submit-intent`, `@near-intents-agent-api/sdk`, owner-signed spending policies, agent swaps/transfers/withdrawals/deposits, or when someone wants an AI agent to hold and move funds under owner-set limits.
---

# NEAR Intents Agent API

A backend HTTP API that gives each AI agent its own **agent account on NEAR Intents**. The end
user (the **owner**) signs the rules once with their own wallet; the agent then swaps, transfers
and withdraws on its own, inside those rules, with no further signatures. Your backend holds one
partner API key and never touches anyone's private keys.

| Party | Credential | Does |
|---|---|---|
| **Partner** (your backend) | API key `naa_…` from the [partner dashboard](https://partners.near-intents.org/) | Calls every endpoint, prepares owner actions, stores grants |
| **Owner** (end user) | Their wallet: NEAR account, EVM key or passkey | Signs: create account, policy, grants, freeze, approve, delete |
| **Agent** (assistant, bot, session) | Grant token `ngt_…` (held by your backend) | Moves money inside the owner's policy |

Hosted API: `https://api.agentsonintents.com` (mainnet, real funds), also the TypeScript SDK's
default `baseUrl`. Machine-readable contract: `/openapi.json`; compact LLM guide: `/llms.txt`.

## Non-negotiable rules

Follow these in every integration; most bugs and lost-fund incidents come from breaking one.

1. **API key and grant tokens are backend-only.** Never ship `naa_…`/`ngt_…` to a browser, mobile
   app, prompt, log or LLM context. Browsers only see `intent.payload` + `preview` and return the
   wallet's output.
2. **The owner's wallet signs `intent.payload` exactly as returned.** Pick the method from
   `intent.standard` (`nep413`, `nep366`, `eip712`, `webauthn`). Never rebuild, re-serialize,
   hash or reorder it; submit `{...intent, <wallet output fields>}`.
3. **Amounts are atomic integer strings** (`"1000000"` = 1 USDC at 6 decimals). Get `decimals`
   and `asset_id` from `GET /v1/tokens`. Never use floats.
4. **Every money-moving call carries an `Idempotency-Key`** (8–128 chars `[A-Za-z0-9._:-]`).
   Create it, persist it with the request, *then* send. Retry only with the same key and body.
5. **`UNCERTAIN` means "maybe executed".** Keep polling the original `correlation_id`. Never
   resubmit with a new key; `/recover` is only for provably-undispatched operations. An
   execution the provider may have received answers `202 UNCERTAIN`. A server failure
   (`internal_error`, `database_busy`, `transaction_unconfirmed`) carries `meta.retryable` and
   may have taken effect: repeat it under the **same** key. A missing `meta.retryable` is not
   proof that nothing was sent: use a new key only after a proven refusal (see
   [errors.md](references/errors.md) retry rules).
6. **`NEEDS_REVIEW` means stop.** Do not poll or retry; inspect `details.reason`, resolve, then
   `GET /v1/status?correlation_id=…&refresh=true`.
7. **Policies are always sent complete**, with `expected_revision` from `GET …/policy`. On
   `policy_revision_conflict`, re-read and get a fresh signature.
8. **A policy is in force only when `status: "APPLIED"` and `provider_policy_synced: true`.**
   Before that, executions fail with `policy_not_ready`.
9. **Branch on `errors[0].code`**, never on `title`/`detail`. Refusal codes name the layer that
   refused (grant, policy action, destination, provider policy, USD budget, schedule); only changing that
   layer lifts it.
10. **Funds go only to `details.deposit_address`.** A `correlation_id` (`op_…`/`intent_…`) is a
    tracking id, never an address.
11. **One grant per session/assistant/bot.** Grants say *who* may act; the account policy says
    *what*. Revoke a grant to cut off one agent; `agent_freeze` stops everyone.

## Quick start (5 minutes, any language)

1. Create a partner API key in the **[partner dashboard](https://partners.near-intents.org/)** (**API keys**). The `naa_…` token is
   shown once — put it in your backend's secret store as `NEAR_INTENTS_AGENT_API_KEY`.
2. Smoke-test:
   ```bash
   curl -s https://api.agentsonintents.com/v1/network            # public: service health
   curl -s https://api.agentsonintents.com/v1/whoami -H "X-API-Key: $NEAR_INTENTS_AGENT_API_KEY"
   curl -s https://api.agentsonintents.com/v1/quotas -H "X-API-Key: $NEAR_INTENTS_AGENT_API_KEY"
   ```
   Or run [scripts/check_api.sh](scripts/check_api.sh).
3. Follow the lifecycle below. Full walkthrough: [references/getting-started.md](references/getting-started.md).

## The lifecycle

```
owner signs ──► agent_create (policy) ──► grant_issue (token commitment) ──► fund (deposit)
                                                                      │
          agent (with X-Grant-Token) ──► swap / transfer / withdraw ──► GET /v1/status
```

1. **Create the account** — `POST /v1/generate-intent {type:"agent_create", name, owner, policy}`
   → owner signs → `POST /v1/submit-intent` → poll `GET /v1/status` to `SUCCESS`.
2. **Issue a grant** — your backend makes a random `ngt_…` token, sends only its SHA-256 hex as
   `credential` in `grant_issue` with `label` and `expires_at` (≤365 days); owner signs; you store
   the token encrypted.
3. **Fund** — `POST /v1/agents/{agent_id}/deposit {origin_asset}` (API key + Idempotency-Key, no
   grant; `amount` optional) returns `details.deposit_address`, `min_amount`, `expires_at`,
   optional `memo`, and `refund_to` (the agent's own balance).
4. **Act** — `POST /v1/agents/{agent_id}/swap|transfer|withdraw|shield|unshield` with
   `X-API-Key`, `X-Grant-Token`, `Idempotency-Key`. Quote first with `dry: true` (swap/withdraw).
5. **Observe** — `GET /v1/status?correlation_id=…&wait_ms=30000` until it stops moving.

Every owner action (policy edits, freeze, grant revoke, approval votes, cancel, delete) is the
same generate → sign → submit → status loop.

## Pick your language path

| Stack | Use | Reference |
|---|---|---|
| TypeScript / Node 24+ | `npm i @near-intents-agent-api/sdk` (typed, thin, no signers) | [references/typescript.md](references/typescript.md) |
| Python | Copy [assets/python/near_intents_agent_api.py](assets/python/near_intents_agent_api.py) (client + NEAR/EVM signers) | [references/python.md](references/python.md) |
| Rust | Copy [assets/rust/](assets/rust/) (async client + signers, `evm` feature) | [references/rust.md](references/rust.md) |
| Go, Java, Kotlin, C#, Ruby, PHP, … | Plain HTTP + generate types from `/openapi.json` | [references/other-languages.md](references/other-languages.md) |

The Python and Rust signers are verified byte-for-byte against near-api-js and viem using
[assets/test-vectors.json](assets/test-vectors.json); check any new port against the same file.

## Where to look

| You need to… | Read |
|---|---|
| Understand accounts, policy vs grant, who enforces what | [references/concepts.md](references/concepts.md) |
| Every endpoint, header, shape, pagination | [references/http-api.md](references/http-api.md) |
| Run owner actions, previews, expiry, cooldowns, BFF split | [references/owner-intents.md](references/owner-intents.md) |
| Sign `nep413` / `nep366` / `eip712` / `webauthn` correctly | [references/signing.md](references/signing.md) |
| Write or edit a policy (limits, destinations, USD budget, timelock, schedule, approval) | [references/policy.md](references/policy.md) |
| Issue, use, store, revoke grants | [references/grants.md](references/grants.md) |
| Swap, transfer, withdraw, deposit, shield, quotes, chains | [references/executions.md](references/executions.md) |
| Statuses, polling, idempotency, `UNCERTAIN`, `/recover`, operation proofs | [references/status-and-recovery.md](references/status-and-recovery.md) |
| Handle an error code | [references/errors.md](references/errors.md) |
| Design the integration (data model, AI tools, key ownership models, security) | [references/architecture.md](references/architecture.md) |
| Find a runnable example for a flow | [references/examples.md](references/examples.md) |

## When writing code for a user

- Read `NEAR_INTENTS_AGENT_API_URL`/`NEAR_INTENTS_AGENT_API_KEY` from env; the base URL is `https://api.agentsonintents.com`
  unless the user runs a self-hosted or local deployment (then only the base URL changes).
- Show `preview.summary` (and `preview.policy` / `preview.deletion`) to the owner before signing.
- Read `GET /v1/network` before acting and after `quote_unavailable`, `route_unavailable` or
  `provider_unavailable`; if a component is `down`, wait rather than change the request.
- Writes against mainnet move real money: build in dry-run/quote mode first and gate live
  execution behind an explicit flag, as the examples do (`AGENT_ALLOW_WRITES`, `AGENT_EXECUTE`).
- Do not invent endpoints or fields. If unsure, fetch `/openapi.json` or `/llms.txt` from the
  deployment and use what it says; the server is the source of truth.
