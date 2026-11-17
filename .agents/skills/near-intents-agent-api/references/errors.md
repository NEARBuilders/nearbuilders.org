# Errors

Every error is a JSON:API document:

```json
{
  "errors": [{
    "status": "409",
    "code": "policy_revision_conflict",
    "title": "Policy revision conflict",
    "detail": "The policy changed since you read it. Read GET /agents/{agent_id}/policy and generate again with its revision.",
    "source": { "pointer": "/expected_revision" },
    "meta": { "retryable": false, "available_at": "2026-10-07T10:10:00Z" }
  }],
  "meta": { "request_id": "…" }
}
```

- Branch on `errors[0].code`. `title`/`detail` are for humans and may change.
- Validation failures (`400 validation_failed`) return **one entry per field** with
  `source.pointer`; show all of them.
- `meta.retryable: true` → the same request (same idempotency key and body) can succeed after
  `Retry-After`. Server failures carry it too: they may have taken effect, so only the same key is
  safe. Absent → repeating will not help now. It says **nothing** about whether an earlier
  attempt took effect; a new key is allowed only after a proven refusal (retry rule 4). Never
  decide from `detail`.
- `meta.available_at` → when a cooldown/quota/throttle lifts. 429/503 also send `Retry-After`.
- Unknown code → fall back to the HTTP status class. Always log `meta.request_id`.

## Decision table

| Code | HTTP | What to do |
|---|---|---|
| **Auth & request** | | |
| `invalid_api_key` | 401 | wrong or revoked key, stray whitespace, or a base URL from a different deployment; fix config, don't retry |
| `validation_failed` | 400 | fix the fields in `source.pointer` |
| `invalid_json`, `invalid_cursor` | 400 | fix the request |
| `idempotency_key_required` | 400 | add `Idempotency-Key` |
| `idempotency_conflict` | 409 | same key used with a different body; resend original body or use a new key for a genuinely new request |
| `rate_limited` | 429 | wait `Retry-After`, retry the same request |
| `database_busy` | 503 | retryable; may have taken effect → retry with the **same** idempotency key, never a new one |
| **Refusals (layer named; only that layer can lift it)** | | |
| `agent_grant_required` | 403 | missing/revoked/expired/foreign grant → issue a grant or use the right token |
| `policy_action_denied` | 403 | action (or confidential form) not in policy → owner `policy_update` |
| `policy_destination_denied` | 403 | address not allowed → owner adds it to `destinations` |
| `policy_schedule_denied` | 403 | outside the owner's `schedule` when it would run (after the timelock); nothing recorded → submit the same request at `meta.available_at`, or owner changes `schedule` |
| `spend_budget_exceeded` | 403 | shared USD budget used up → wait for window (`usage.budget.*.resets_at`) or owner raises cap; retry with a **new** key |
| `policy_denied` | 409 | provider-side policy refused (asset, per-asset limit, hourly rate, …) → owner `policy_update` |
| `wallet_frozen` | 409 | owner froze the account → only `agent_unfreeze` resumes |
| `policy_not_ready` | 409 | latest policy not yet in force → wait for the policy intent to settle |
| `signing_policy_denied` | 403 | recipient not in the policy's `sign.recipients` |
| `signing_recipient_forbidden` | 403 | `intents.near`/`intents.far` are never signing recipients |
| **Execution / routing** | | |
| `insufficient_balance` | 409 | fund the account or lower amount |
| `amount_too_low` | 400 | below route minimum → quote a larger amount |
| `route_unavailable` | 400 | no route/liquidity now; nothing submitted → other pair or later, new key |
| `quote_unavailable` | 503 | upstream quote got no answer; nothing submitted → retry shortly, new key; check `/v1/network` |
| `unsupported_chain`, `unsupported_token`, `invalid_address` | 400/409 | change chain/asset/address |
| `wrapped_unsupported` | 400 | drop `wrapped`; it only applies to NEAR withdrawn to chain `near` |
| `wallet_busy` | 409 | another money op on this wallet is running; nothing sent, refusal recorded (not retryable) → after it finishes, a **new** key |
| `spend_price_unavailable` | 503 | no fresh USD price for budget accounting → retry later, new key |
| `authorization_stale` | 409 | grant/key revoked or policy/owner changed between admission and dispatch → re-evaluate |
| `deposit_quota_exceeded` | 429 | 100 deposit addresses / 24 h for this agent → wait `available_at` |
| **Provider (wallet service/1Click) state** | | |
| `provider_unavailable` | 503 | provider down/breaker open → wait; read `/v1/network` |
| `provider_limit_reached` | 429 | custody provider's daily quota for this wallet: 100 operations / rolling 24 h, `dry` previews included, quotes not; nothing sent → new work at `available_at` (don't burn the quota on repeated previews) |
| `provider_rate_limited` | 429 | reads: wait `Retry-After`, same request; executions: recorded refusal → new key after a short wait |
| `provider_refused` | 409 | provider refused for its own reason → inspect `detail`, don't blind-retry |
| `provider_response_invalid`, `provider_request_mismatch` | 502 | treat outcome as unknown → poll status of the same id |
| **Owner intents** | | |
| `intent_expired` | 409 | generate a new intent |
| `intent_payload_mismatch`, `intent_standard_mismatch`, `intent_type_mismatch` | 409 | submit exactly what was generated, with the right standard/type |
| `signature_invalid` | 400 | malformed wallet output → submit exactly what the wallet returned |
| `signer_mismatch`, `owner_proof_invalid`, `policy_delegate_signature_invalid` | 401/409 | wrong key or altered bytes (see [signing.md](signing.md)) |
| `owner_key_not_full_access` | 403 | NEAR owner must sign with a FullAccess key |
| `owner_nonce_invalid` | 409 | intent used/expired → regenerate |
| `intent_generation_recovery_required` | 409 | retry `generate-intent` with the same idempotency key |
| `policy_revision_conflict` | 409 | re-read policy, regenerate with new `expected_revision`, re-sign |
| `policy_reconciliation_required` | 409 | another policy intent still open → wait |
| `policy_change_throttled`, `agent_unfreeze_throttled` | 429 | cooldown → wait `available_at` |
| `wallet_already_frozen`, `wallet_already_unfrozen` | 409 | no-op; state already as requested |
| `owner_type_unsupported` | 400 | this deployment does not accept that owner type for new agents (check `supported_owner_types` on `GET /v1/network`; EVM is off by default until the final EVM wallet build) |
| `agent_creation_quota_exceeded` | 429 | 100 agents/24 h → wait or request quota |
| `agent_not_bound` | 409 | onboarding not finished → wait for `agent_create` SUCCESS |
| `agent_archived`, `agent_deleted`, `agent_deletion_pending` | 409 | lifecycle state forbids it; restore or stop |
| `pause_before_archive`, `unpause_before_restore` | 409 | `agent_freeze` before `agent_archive`; `agent_unfreeze` before `agent_restore` |
| `sponsor_busy`, `sponsor_balance_insufficient` | 503 | retry the same submit later |
| `transaction_unconfirmed` | 503 | retryable; broadcast but unconfirmed → poll status, or repeat with the **same** key (never sends twice); never as new work |
| `execution_not_cancellable` | 409 | op already left `QUEUED` |
| `approval_closed`, `approval_already_voted`, `approval_not_allowed` | 409 | read the approval's current state |
| `approval_signature_invalid` | 401 | the vote was not signed by the owner's key or wallet → regenerate and sign again |
| `approval_vote_unsupported` | 409 | the provider lists no such owner wallet build on this network → ask the operator; nothing was stored |
| **Grants** | | |
| `grant_limit_reached` | 409 | 50 live grants → revoke unused |
| `grant_credential_reused` | 409 | new token per grant |
| `grant_expiry_invalid` | 409 | `expires_at` must be future and ≤365 days |
| **Recovery** | | |
| `operation_not_recoverable` | 409 | not UNCERTAIN, already dispatched, non-recoverable kind, or other API key → keep polling |
| `operation_recovery_unavailable` | 409 | another recovery running → poll |
| **Not found** | 404 | `agent_not_found`, `grant_not_found`, `intent_not_found`, `operation_not_found`, `status_not_found`, `approval_not_found` |
| **Disabled** | | |
| `transparency_log_disabled` | 501 | this deployment keeps no transparency log; operation proofs are unavailable |

## Retry rules

1. **Client timeout or network error on a write**: you don't know if it landed. Retry with the
   **same** `Idempotency-Key` and identical body (safe), or read status if you got a
   `correlation_id`. Never invent a new key for the same intent to "unstick" it.
2. **Refusal codes (403, most 409)**: the request is wrong for the current state. Retrying the
   same thing won't help; change state (policy, grant, balance) or the request.
3. **Server failures** (`internal_error` 500, `database_busy` 503, `transaction_unconfirmed` 503,
   all with `meta.retryable`): the request may have taken effect. Repeat it with the **same** key,
   which replays or reconciles it, or read status. Never a new key: that can spend twice.
4. **Proven refusals** (`route_unavailable`, `quote_unavailable`, `spend_budget_exceeded`,
   `spend_price_unavailable`, `wallet_busy`, and the policy/grant/validation refusals in the
   decision table): nothing was sent and the key replays the refusal; a later attempt is a new
   request → **new** idempotency key. Only these permit a new key. A `FAILED` or `REFUNDED`
   status is **not** such proof: a partial failure is `FAILED`. Read its `details` and the
   balances, and send new work only as an explicit decision, never as an automatic retry.
5. **Earlier work under the key** (`intent_generation_recovery_required`,
   `operation_not_recoverable`, `operation_not_pending`, any error from `/recover`, and any error
   after a server failure or lost response): the original outcome may still be unknown. Keep the original key and
   `correlation_id`, read status, and never start the same work under a new key.
6. **Throttles** (429): wait until `available_at` / `Retry-After`.
7. **Status-level outcomes** (`FAILED`, `REFUNDED`, `UNCERTAIN`, `NEEDS_REVIEW`) are not HTTP
   errors; see [status-and-recovery.md](status-and-recovery.md).

## Wrapping errors in your code

TypeScript SDK: `AgentApiError { status, code, title, detail, retryable, availableAt, requestId,
errors, idempotencyKey }`; transport failures throw `AgentApiRequestError { idempotencyKey }`.
The Python/Rust assets mirror this (`AgentApiError.code`, `.available_at`, …; Rust
`Error::Api { … }` with `error.code()`).

For AI agents, convert errors into short tool results that name the layer and the fix, e.g.
`"refused by account policy: withdraw is not enabled. Ask the owner to allow withdrawals."` —
never echo API keys, grant tokens, or full request headers into model context.
