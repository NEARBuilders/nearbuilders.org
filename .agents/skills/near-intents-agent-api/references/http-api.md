# HTTP API reference

Base URL `https://api.agentsonintents.com`. The live contract is `GET /openapi.json`; a compact
guide is `GET /llms.txt`. If this file and the server disagree, the server wins.

## Conventions

- **JSON, snake_case** everywhere (fields, query, errors). Statuses are UPPER_SNAKE. Exception:
  `intent.payload` keeps its wallet standard's own field names (`receiverId`, `methodName`,
  `primaryType`, …) because the wallet consumes it as is.
- **Headers**
  | Header | When |
  |---|---|
  | `X-API-Key: naa_…` | every endpoint except `/v1/network`, `/v1/tokens` |
  | `X-Grant-Token: ngt_…` | swap, withdraw, transfer, shield, unshield, recover, sign (not dry quotes, not deposit) |
  | `Idempotency-Key` | required on executions and deposit (not on `dry: true`); optional on `generate-intent`. 8–128 chars `[A-Za-z0-9._:-]` |
  | `Content-Type: application/json` | every body |
- Responses carry `x-request-id`; errors repeat it as `meta.request_id`. Log it.
- **Amounts**: atomic integer strings, up to 78 digits. **USD**: decimal strings (`"50"`, `"12.5"`).
- **Durations**: milliseconds (`timelock_ms`, `wait_ms`, `delay_ms`). **Times**: ISO-8601 UTC.
- **Ids**: `agent_id`, `grant_id` = 64 hex; `correlation_id` = `op_…` (execution) or
  `intent_…` (owner intent); `approval_id` = UUID.
- **Pagination**: `{ data: [...], next_cursor: string | null }`; pass `cursor=<next_cursor>`
  until null. Policy history uses an integer cursor.
- **Timeouts**: give settlement writes (non-dry swap/withdraw/transfer/shield/unshield) ~150 s,
  everything else ~65 s (long-poll is 30 s max). Don't retry on client timeout with a new key.
- **Errors**: JSON:API `{ errors: [{ status, code, title, detail?, source?, meta? }], meta: { request_id } }`.
  Branch on `errors[0].code`. `meta.retryable`, `meta.available_at`, and `Retry-After` header on
  429/503. See [errors.md](errors.md).

## Endpoint catalogue

### Meta (no side effects)

| Method & path | Auth | Returns |
|---|---|---|
| `GET /v1/network` | none | `{ network: "mainnet", contract_id, supported_owner_types, status: { overall, checked_at, components[] } }` |
| `GET /v1/tokens` | none | `{ data: [{ asset_id, symbol, decimals, blockchain, price, price_updated_at, price_expires_at }] }` |
| `GET /v1/whoami` | key | `{ api_key_id, tenant_id }` |
| `GET /v1/quotas` | key | `{ revision, overrides, limits: { daily_agents, api_keys, requests_per_minute, key_requests_per_minute }, usage: {…}, observed_at }` |
| `GET /openapi.json`, `GET /llms.txt`, `GET /health` | none | contract, guide, liveness |

`status.components[]`: `{ id: "one_click" | "custody" | "near", status: "operational" | "degraded" | "down" | "unknown", reason, affects[], since, checked_at }`.
Advisory only; the API never refuses a request because of it.

### Owner intents

| Method & path | Auth | Body | Returns |
|---|---|---|---|
| `POST /v1/generate-intent` → 201 | key (+ optional idem) | `{ type, agent_id?, …type fields }` | `GenerateIntentResponse` |
| `POST /v1/submit-intent` → 202 | key | `{ type, correlation_id, signed_data }` | `StatusResponse` |

Details: [owner-intents.md](owner-intents.md), signing: [signing.md](signing.md).

### Status

| Method & path | Auth | Query | Returns |
|---|---|---|---|
| `GET /v1/status` | key | `correlation_id`, `wait_ms` (0–30000), `refresh` (bool) | `StatusResponse` |
| `GET /v1/agents/{agent_id}/history` | key | `cursor`, `limit` (1–100, default 25), `include_unpaid` (bool, default false) | page of `StatusResponse` |
| `GET /v1/agents/{agent_id}/operations/{correlation_id}/proof` | key | path `correlation_id` is an `op_…` id | `{ correlation_id, origin, notary, events }`: each audit event of the execution with a `c2sp.org/tlog-proof@v1` (`PROVEN`) and its `evidence` (the recorded result, hashed into the opening), `PENDING` until the next checkpoint, or `UNLOGGED`; `notary` holds the verifier keys and TDX birth attestation. A deployment without a transparency log answers 501 `transparency_log_disabled` |

### Agents and reads

| Method & path | Query | Returns |
|---|---|---|
| `GET /v1/agents` | `external_user_id`, `cursor` | page of `AgentView` |
| `GET /v1/agents/{agent_id}` | | `AgentView` |
| `GET /v1/agents/{agent_id}/wallet` | | `{ wallet_id, near_account_id }` |
| `GET /v1/agents/{agent_id}/balances` | `source` = `public` \| `confidential`, `asset` | `{ near_account_id, source, balances: BalanceEntry[] }` |
| `GET /v1/agents/{agent_id}/addresses/near` | | `{ chain: "near", address }` |
| `GET /v1/agents/{agent_id}/policy` | | `PolicyView` |
| `GET /v1/agents/{agent_id}/policy/history` | `cursor` (int), `limit` | page of policy revisions |
| `GET /v1/agents/{agent_id}/grants` | | `{ data: GrantView[] }` (revoked included) |
| `GET /v1/agents/{agent_id}/executions/scheduled` | `cursor`, `limit` | `{ data: [{ correlation_id, execute_after, state, action }], next_cursor }` |
| `GET /v1/agents/{agent_id}/approvals` | | `{ data: ApprovalView[] }` |
| `GET /v1/agents/{agent_id}/approvals/{approval_id}` | | `ApprovalView` |
| `GET /v1/agents/{agent_id}/containment` | `grants_cursor`, `operations_cursor` | live grants + unfinished operations ("what is still able to act") |
| `GET /v1/agents/{agent_id}/provider/{kind}` | `kind` = requests \| audit \| deposits \| deposit_history; `limit`, `offset`, `type` | provider's raw records (`{ data }`) |

### Executions (all `POST /v1/agents/{agent_id}/…`, 202)

| Path | Auth | Body |
|---|---|---|
| `/swap` | key, grant, idem | `origin_asset`, `destination_asset`, `amount`, `min_amount_out?`, `confidential?`, `dry?` |
| `/withdraw` | key, grant, idem | `asset`, `amount`, `chain`, `recipient`, `memo?`, `confidential?`, `wrapped?`, `async?`, `dry?` |
| `/transfer` | key, grant, idem | `asset`, `amount`, `recipient` (NEAR Intents account), `confidential?` |
| `/shield`, `/unshield` | key, grant, idem | `asset`, `amount` |
| `/deposit` | key, idem | `origin_asset`, `destination_asset?`, `amount?`, `confidential?` |
| `/recover` | key, grant, idem (original) | `correlation_id`, `request: { type, …original body }` |
| `/sign` → 200 | key, grant | `message`, `encoding?`, `recipient` (must be in the policy's `sign.recipients`; never `intents.near`/`intents.far`) |

`dry: true` on swap/withdraw → 200 `{ dry: true, type, quote }`; no grant, no idempotency key
needed. Details: [executions.md](executions.md).

## Core shapes

```ts
StatusResponse = {
  correlation_id: string,                  // op_… | intent_…
  agent_id: string | null,
  type: "agent_create" | "policy_update" | "agent_freeze" | "agent_unfreeze" | "agent_archive"
      | "agent_restore" | "agent_delete" | "grant_issue" | "grant_revoke" | "execution_cancel"
      | "approval_vote" | "swap" | "withdraw" | "transfer" | "shield" | "unshield" | "deposit",
  status: "PENDING_SIGNATURE" | "QUEUED" | "PENDING_APPROVAL" | "PENDING_DEPOSIT" | "PROCESSING"
        | "SUCCESS" | "REFUNDED" | "FAILED" | "UNCERTAIN" | "NEEDS_REVIEW",
  failure_code: string | null,
  created_at, updated_at,
  dispatch_committed_at: string | null,
  grant: { id, label } | null,
  details: { … by type … }
}
```

`details` by type:

| type | details |
|---|---|
| executions, `deposit`, `agent_delete` | `action`, `near_account_id?`, `provider_request_id?`, `chain?`, `execute_after?`, `delay_ms?`, `approval_id?`, `intent_hash?`, `tx_hash?`, `destination_tx_hash?`, `amount_out?`, `deposit_address?`, `memo?`, `min_amount?`, `min_amount_out?`, `expires_at?`, `refund_to?`, `refund_tx_hash?`, `failure_reason?`, `reason?` (NEEDS_REVIEW), `never_executed?`, `never_submitted?`, `settled_late?`, + provider fields |
| `agent_create` | `agent_id`, `revision`, `policy_hash`, `transaction_hash` |
| `policy_update`, `agent_freeze`, `agent_unfreeze` | `revision`, `policy_hash`, `transaction_hash` (null for off-chain changes) |
| `grant_issue` | `grant: GrantView \| null` |
| `grant_revoke` | `grant_id`, `committed_correlation_ids`, `committed_truncated` |
| `execution_cancel` | `cancelled_correlation_id` |
| `agent_archive`, `agent_restore` | `archived` |
| `approval_vote` | `approval_id`, `verdict` |

Narrow on `type` before reading `details`.

```ts
AgentView = {
  id, name, external_user_id: string | null,
  status: "PENDING" | "ACTIVE" | "ARCHIVED" | "DELETED" | "ABANDONED",
  archived, deleted,
  owner: OwnerWallet | null,
  owner_account: { account_id, public_key, authority: "wallet" } | null,
  wallet: { wallet_id, near_account_id } | null,
  created_at,
  cooldowns: { policy_change_available_at: string | null, unfreeze_available_at: string | null }
}

PolicyView = {
  wallet_id, revision: int | null, policy_hash, status: "NONE" | "SIGNED" | "APPLIED" | "FAILED",
  applied_at, transaction_hash,
  provider_policy_synced: boolean,         // in force only when APPLIED && true
  cooldowns, policy: Policy | null,
  usage: {
    budget: { daily|weekly|monthly: { limit_usd, spent_usd, remaining_usd, resets_at } },
    timelock: { delay_ms, scheduled_count }
  }
}

BalanceEntry = { asset_id, symbol, decimals, blockchain, price, …, balance_raw: string, balance: string | null }

GrantView = { grant_id, agent_id, wallet_id, label, issued_at, expires_at,
              revoked_at, revoked_reason, owner_epoch, owner_message }

ApprovalView = { approval_id, wallet_id, wallet_pubkey, request_hash,
                 status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED",
                 request_type, request_data, required_approvals, expires_at }

OwnerWallet =
  | { type: "near", account_id, public_key: "ed25519:…" }
  | { type: "evm", address: "0x…" (lowercase), chain_id: number, public_key: "0x" + 128 hex }
  | { type: "passkey", credential_id, public_key (b64url DER SPKI), rp_id, origin }
```

The `Policy` shape is in [policy.md](policy.md).

## curl cheatsheet

```bash
H=(-H "X-API-Key: $NEAR_INTENTS_AGENT_API_KEY" -H "Content-Type: application/json")
curl -s "$NEAR_INTENTS_AGENT_API_URL/v1/agents?external_user_id=user_123" "${H[@]}"
curl -s "$NEAR_INTENTS_AGENT_API_URL/v1/agents/$AGENT_ID/policy" "${H[@]}"
curl -s "$NEAR_INTENTS_AGENT_API_URL/v1/agents/$AGENT_ID/balances?source=public" "${H[@]}"
curl -s "$NEAR_INTENTS_AGENT_API_URL/v1/status?correlation_id=$CID&wait_ms=30000" "${H[@]}"
curl -s -X POST "$NEAR_INTENTS_AGENT_API_URL/v1/agents/$AGENT_ID/swap" "${H[@]}" -H "X-Grant-Token: $GRANT" \
  -d '{"origin_asset":"nep141:wrap.near","destination_asset":"'"$USDC"'","amount":"100000000000000000000000","dry":true}'
```
