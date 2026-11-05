# Executions: moving money

All are `POST /v1/agents/{agent_id}/<action>` and return `202` with a `StatusResponse`
(`correlation_id: "op_…"`), except dry quotes (`200`).

| Action | Headers | Body | Policy needs |
|---|---|---|---|
| `swap` | key, grant, idem | `origin_asset`, `destination_asset`, `amount`, `min_amount_out?`, `confidential?`, `dry?` | `swap` (+`confidential`) |
| `withdraw` | key, grant, idem | `asset`, `amount`, `chain`, `recipient`, `memo?`, `confidential?`, `wrapped?`, `async?`, `dry?` | `withdraw`, destination allowed |
| `transfer` | key, grant, idem | `asset`, `amount`, `recipient`, `confidential?` | `transfer`, destination allowed |
| `shield` / `unshield` | key, grant, idem | `asset`, `amount` | `confidential: true` |
| `deposit` | key, idem | `origin_asset`, `destination_asset?`, `amount?`, `confidential?` | nothing (always allowed) |
| `recover` | key, grant, original idem | `correlation_id`, `request: {type, …original body}` | re-authorized in full |

`amount` is atomic (integer string). Asset ids come from `GET /v1/tokens`.

## Quote first

```json
POST …/swap      { "origin_asset": "nep141:wrap.near", "destination_asset": "<usdc>", "amount": "1000000000000000000000000", "dry": true }
POST …/withdraw  { "asset": "<usdc>", "amount": "5000000", "chain": "base", "recipient": "0xabc…", "dry": true }
→ 200 { "dry": true, "type": "swap", "quote": { …1Click quote, snake_cased… } }
```

Dry runs need no grant and no idempotency key, charge no budget and move nothing. The `quote`
object belongs to 1Click (amount out, fees, time estimate); treat its fields as informational
and do not hard-code its shape. Use it to show the user expected output and to choose
`min_amount_out` (slippage floor).

## Execute

```http
POST /v1/agents/{agent_id}/swap
X-API-Key: naa_…
X-Grant-Token: ngt_…
Idempotency-Key: swap:user123:2026-10-07T10:00:00Z:7f3c
Content-Type: application/json

{ "origin_asset": "nep141:wrap.near", "destination_asset": "<usdc>", "amount": "1000000000000000000000000", "min_amount_out": "2900000" }
```

Then poll `GET /v1/status?correlation_id=op_…&wait_ms=30000` (see
[status-and-recovery.md](status-and-recovery.md)). Typical paths:

- no timelock/approval: `PROCESSING` → `SUCCESS` (`details.amount_out`, `intent_hash`, `tx_hash`)
- timelock: `QUEUED` (`details.execute_after`) → `PROCESSING` → …
- approval: `PENDING_APPROVAL` (`details.approval_id`) → owner votes → `PROCESSING` → …
- route refunded: `REFUNDED` (`details.refund_tx_hash`); never filled: `FAILED` with `failure_code`

The execution call holds the HTTP request open up to ~2 minutes while the provider answers; give
the client a ~150 s timeout. `withdraw` with `async: true` returns as soon as it is accepted.

## Swap

- Inside the account; funds never leave NEAR Intents. Needs no destination rule.
- `min_amount_out`: atomic floor of the destination asset; the swap refunds rather than fill
  below it.
- `amount_too_low`: below the route minimum (confidential swaps have their own minimum).
- `route_unavailable` / `quote_unavailable`: nothing was submitted; retry later with a **new**
  idempotency key or pick another pair.

## Withdraw

- Leaves NEAR Intents to `recipient` on `chain`. Public and confidential withdrawals reach every
  `blockchain` value `GET /v1/tokens` lists (`near`, `eth`, `sol`, `btc`, `tron`, …).
- `memo` for chains/exchanges that need one (the policy's `only` rule matches memo exactly).
- NEAR (`nep141:wrap.near`, or `near`) withdrawn to chain `near` arrives as **native NEAR**, as from
  a NEAR wallet or 1Click: no `wrap.near` registration needed, and what exchanges and invoices
  expect. `wrapped: true` delivers wNEAR instead; only for that route (`wrapped_unsupported`).
- `unsupported_chain` means a chain the catalog doesn't list; `route_unavailable` means no
  liquidity for that asset now; `invalid_address` when the provider rejects the address format.
- `details.destination_tx_hash` appears once the destination chain confirms.

## Transfer

- To another NEAR Intents account (`recipient` = NEAR account id), no bridge, near-instant.
  A recipient is a named account (`alice.near`), a 64-hex implicit account or a lowercase `0x`
  EVM address.
- `confidential: true` spends from and to confidential balances. Shield first if the agent's
  confidential balance is short.
- **near.com addresses.** near.com shows its users' Intents account as `nearcom:<account>`
  (e.g. `nearcom:0x20b6…2367`). The API takes only the bare account: strip `nearcom:` and
  lowercase the rest. near.com users see their confidential balance, so send them a
  `confidential: true` transfer by default. A public transfer still works when the user asks for
  one, but it lands in the recipient's legacy public balance, which near.com does not show by
  default: tell the user before sending. A `nearcom:` address is not on any chain: never
  `withdraw` to it.

## Shield / unshield

Move `amount` of `asset` between the public and confidential balance of the same account.
Read both with `GET …/balances?source=public|confidential`.

## Deposit (fund the account)

```http
POST /v1/agents/{agent_id}/deposit
X-API-Key: naa_…
Idempotency-Key: dep:user123:<uuid>
{ "origin_asset": "<asset_id on the paying chain>", "amount": "25000000" }
```

- `origin_asset` is required: the token and chain the payer sends from.
- `amount` is optional. Without it, any payment ≥ `details.min_amount` before
  `details.expires_at` is credited; with it, the quote is exact.
- `destination_asset` optional: swap to another asset on arrival. `confidential: true` credits the
  confidential balance.
- There is **no `refund_to` request field**: refunds always go back to the agent account;
  `details.refund_to` reports where.
- Response `PENDING_DEPOSIT` with `details.deposit_address` (send funds **only** there),
  `details.memo` (include it if present), `details.min_amount`, `details.expires_at`.
- Then poll the `op_…` id: `PENDING_DEPOSIT` → `PROCESSING` → `SUCCESS`.
- Without `amount` an address stays open 3 days; with it, 24 h. Each lookup issues a new address.
- Quota: 100 deposit addresses per agent per rolling 24 h → `deposit_quota_exceeded` (429).
- Native NEAR-side funding: `GET …/addresses/near` returns the account; send NEP-141 tokens to it.

Never show the `correlation_id` as a payment address. Use a fresh idempotency key per deposit
request you want (reusing the key returns the same address).

## Recover (rare)

Only for `UNCERTAIN` operations that provably never reached the provider (no
`provider_request_id`, no `dispatch_committed_at`). Same API key, same grant token, same
`Idempotency-Key`, and `request` = the original body plus `type`. See
[status-and-recovery.md](status-and-recovery.md).

## Pre-flight checklist for an agent tool

1. `GET …/policy` in force? action allowed? destination listed? budget `remaining_usd` enough?
2. Balance enough? (`GET …/balances`)
3. Dry quote (swap/withdraw) and show it.
4. Create + persist the idempotency key and body, then send.
5. Poll to a stable status, report `SUCCESS`/`REFUNDED`/`FAILED` with hashes; for `UNCERTAIN`
   say "outcome pending" and keep observing.
