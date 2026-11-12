# Owner intents

Every change the owner authorizes uses one loop:

```
backend: POST /v1/generate-intent {type, …}      → { correlation_id, intent, preview, expires_at, signer }
browser: show preview → wallet signs intent.payload (method from intent.standard)
backend: POST /v1/submit-intent {type, correlation_id, signed_data: {...intent, <wallet output>}}
backend: GET /v1/status?correlation_id=…&wait_ms=30000   until SUCCESS / FAILED
```

The API builds the exact bytes, so the partner never assembles anything security-relevant;
`preview.summary` is one human sentence describing what is signed.

## Intent types

| type | Extra fields (besides `agent_id`) | Notes |
|---|---|---|
| `agent_create` | `name`, `external_user_id?`, `owner`, `policy` (no `agent_id`) | reserves a `PENDING` agent and returns its `agent_id` immediately |
| `policy_update` | `policy` (complete), `expected_revision` (current applied revision) | 10-min cooldown between ordinary changes |
| `agent_freeze` | — | emergency stop; immediate; never throttled |
| `agent_unfreeze` | — | own cooldown (`agent_unfreeze_throttled`) |
| `agent_archive` / `agent_restore` | — | hides/unhides from default lists; nothing changes on chain. `agent_archive` needs a frozen account, and `agent_restore` needs an unfrozen one; otherwise `pause_before_archive` / `unpause_before_restore` |
| `agent_delete` | — | `preview.deletion` lists balances and `assets_lost`; withdraw first, there is no sweep. Open deposit addresses never block it: deletion closes them (`agent_deleted`), and funds sent later are lost |
| `grant_issue` | `label`, `credential` (sha256 hex of token), `expires_at` (≤365 days) | see [grants.md](grants.md) |
| `grant_revoke` | `grant_id` | committed operations still finish |
| `execution_cancel` | `correlation_id` of a `QUEUED` op | only while the timelock holds it |
| `approval_vote` | `approval_id`, `verdict: "approve" \| "reject"` | any owner; EVM/passkey votes go through their `0s` wallet |

## Generate response

```ts
{
  correlation_id: "intent_…",
  type, agent_id,
  status: "PENDING_SIGNATURE",
  expires_at: string,                         // submit before this (minutes, not hours)
  signer: OwnerWallet,                        // the wallet that must sign
  intent: { standard: "nep413" | "nep366" | "eip712" | "webauthn", payload },
  preview: {
    summary: string,
    revision?, previous_revision?, policy_hash?, policy?,   // policy changes
    deletion?: { near_account_id, beneficiary, native_balance, public[], confidential[], assets_lost, retirement },
    approval?: { approval_id, request_type, request_hash, verdict }
  }
}
```

The SDK and the reference clients also return the idempotency key they used. If
`generate-intent` is interrupted (timeout, crash), retry with the **same** `Idempotency-Key`;
`intent_generation_recovery_required` means keep that key and retry it rather than starting over.

## Submit

```json
{
  "type": "policy_update",
  "correlation_id": "intent_…",
  "signed_data": { "standard": "nep413", "payload": { "…": "exactly as generated" },
                   "public_key": "ed25519:…", "signature": "<base64>" }
}
```

| standard | `signed_data` = intent + |
|---|---|
| `nep413` | `public_key: "ed25519:…"`, `signature` (base64, base58, `ed25519:<b58>` or hex) |
| `nep366` | `signed_delegate` (base64 borsh `SignedDelegate`) |
| `eip712` | `signature: "0x…"` (65 bytes, 130 hex) |
| `webauthn` | `credential: AuthenticationResponseJSON` (from `@simplewebauthn/browser`) |

Submitting the same signature twice is safe and returns the same operation. The response is
usually `PROCESSING`; on-chain intents (`nep366`, sponsored EVM/passkey calls) settle in seconds
to a minute; off-chain ones settle almost immediately.

## Which standard you get

| Owner | Change enforced by provider (on chain) | Change enforced by API (off chain) |
|---|---|---|
| NEAR | `nep366` delegate action (sponsor pays gas): `agent_create`, provider policy edits, freeze/unfreeze | `nep413`: destinations/budget/timelock/schedule-only edits, grants, cancel, archive, votes, … |
| EVM | `eip712` | `eip712` |
| Passkey | `webauthn` | `webauthn` |

Always switch on `intent.standard`; never assume from the type.

## Backend-for-frontend (BFF) split

The browser never sees the API key or any grant token. A typical pair of routes:

```text
POST /app/agents/:id/intents        (your auth: user owns agent :id)
  → api.generate_intent({...})       → returns { correlation_id, intent, preview, expires_at } to the browser

POST /app/intents/:cid/submit        (your auth: user owns the intent you stored for :cid)
  body: { signed_data }               ← wallet output from the browser
  → api.submit_intent(type, cid, signed_data)
  → api.get_status(cid, wait_ms=30000) → return status
```

Rules:
- Persist `{correlation_id, type, agent_id, user_id, created_at}` when you generate, and on
  submit check that the user owns that correlation id. Never let a client pick `type` or
  `correlation_id` you did not issue to them.
- Validate the user owns `agent_id` (your `external_user_id` mapping) before generating.
- Let the browser only *forward* the wallet output; don't let it supply a different `payload`
  (the API refuses mismatches with `intent_payload_mismatch` anyway).
- Show `preview.summary`, the full `preview.policy`, and for deletes `preview.deletion.assets_lost`.

Browser signing:

```ts
switch (intent.standard) {
  case "eip712":
    return { ...intent, signature: await walletClient.signTypedData({ account, ...intent.payload }) };
  case "nep366": {
    const r = await wallet.signDelegateActions({ delegateActions: [intent.payload] });
    return { ...intent, signed_delegate: r.signedDelegateActions[0] };
  }
  case "nep413": {
    const nonce = Uint8Array.from(atob(intent.payload.nonce), (c) => c.charCodeAt(0));
    const r = await wallet.signMessage({ ...intent.payload, nonce });
    return { ...intent, public_key: r.publicKey, signature: r.signature };
  }
  case "webauthn":
    return { ...intent, credential: await startAuthentication({ optionsJSON: intent.payload }) };
}
```

Adapt to your wallet library's result shape (near-connect / wallet-selector return `publicKey` and
`signature`; the server normalizes base58/base64/hex encodings).

## Errors you should handle here

| Code | Meaning / action |
|---|---|
| `intent_expired` (409) | signing window closed → generate again |
| `intent_payload_mismatch`, `intent_standard_mismatch` | the payload or standard was altered → sign the original |
| `signature_invalid` | malformed wallet output → submit exactly what the wallet returned |
| `signer_mismatch` | wrong key/account signed → have the `signer` wallet sign |
| `owner_key_not_full_access` (403) | NEAR key is a function-call key → use a FullAccess key |
| `owner_nonce_invalid` | intent already used/expired → generate again |
| `policy_revision_conflict` (409) | re-read `GET …/policy`, regenerate with its `revision`, re-sign |
| `policy_reconciliation_required` | another policy intent is still open → wait for it to settle/expire |
| `policy_change_throttled` / `agent_unfreeze_throttled` (429) | wait until `meta.available_at` (also on `GET /v1/agents/{id}` cooldowns) |
| `wallet_already_frozen` / `wallet_already_unfrozen` | already in that state |
| `agent_creation_quota_exceeded` (429) | 100 agents/24h → wait for `available_at` or ask for a higher quota |
| `sponsor_busy` / `sponsor_balance_insufficient` (503) | retry the same submit later |
| `transaction_unconfirmed` (503) | broadcast but not confirmed → poll status, or submit the same signed intent again (never sends twice); never generate a new intent for it |
| `agent_not_bound` | the agent is still onboarding → wait for `agent_create` SUCCESS |

## Recipes

**Edit policy safely**

```text
view = GET /v1/agents/{id}/policy
assert view.status == "APPLIED"
new  = modify(copy(view.policy))                  # complete policy, never a diff
gen  = generate_intent({type:"policy_update", agent_id, policy:new, expected_revision:view.revision})
… owner signs, submit, wait SUCCESS …
poll GET …/policy until status APPLIED && provider_policy_synced
```

**Emergency stop**: `agent_freeze` (no cooldown, takes effect at once). To stop one actor only,
`grant_revoke`. To see what is still live: `GET …/containment`.

**Cancel a timelocked payment**: list `GET …/executions/scheduled`, then `execution_cancel`
with that `correlation_id` before `execute_after`.

**Approve a payment** (policy `owner_approval: true`, any owner type): list `GET …/approvals`, show
`request_data`, then `approval_vote` with `verdict`. The execution moves out of
`PENDING_APPROVAL`; keep polling its `op_…` id. `reject` ends it and releases its budget
charge (`FAILED`, `details.never_executed`). `approve` re-runs the admission checks first: a
revoked or expired grant, a frozen or changed policy, or a destination no longer allowed refuses
the vote (`authorization_stale`, `wallet_frozen`, `policy_destination_denied`), nothing is
sent, and the request stays held for a `reject`. `approval_not_recorded` means the API has not
yet recorded the request under its approval (its dispatch reply was lost): send the same vote
again a few minutes later.

**Delete**: withdraw balances first, `agent_delete`, show `preview.deletion`; refuse to proceed
in your UI when `assets_lost` is true unless the owner explicitly accepts.
