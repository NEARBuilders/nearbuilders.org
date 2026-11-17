# Runnable examples

Repository: <https://github.com/NEAR-Intents-Agent-API/examples> (TypeScript, Node 24+, pnpm,
`@near-intents-agent-api/sdk`, `near-api-js`, `viem`). Every flow in this skill has a script there;
port the script when writing another language.

```bash
git clone https://github.com/NEAR-Intents-Agent-API/examples && cd examples
cp .env.example .env        # NEAR_INTENTS_AGENT_API_KEY from the partner dashboard; owner keys for writes
pnpm install
pnpm 01:check-api
```

Safety switches: writes refuse to run unless `AGENT_ALLOW_WRITES=true`; swaps, withdrawals and
other live actions stay in preview unless `AGENT_EXECUTE=true`. The hosted API is mainnet: use a
dedicated low-value owner account.

| Script | File | Shows |
|---|---|---|
| `01:check-api` | `01-getting-started/01-check-api.ts` | network, whoami, quotas, token catalogue |
| `01:list-tokens` | `01-getting-started/02-list-tokens.ts` | token catalogue, decimals, prices |
| `02:create-agent` | `02-your-first-agent/01-create-agent.ts` | `agent_create` with a NEAR owner (NEP-366) |
| `02:inspect-agent` | `02-your-first-agent/02-inspect-agent.ts` | agent, wallet, NEAR address, policy usage and history, balances, grants, history, provider records |
| `02:multiple-agents` | `02-your-first-agent/03-multiple-agents.ts` | several agents per owner |
| `03:near-policy-local` | `03-owner-wallets/near/01-policy-local.ts` | budget/timelock-only edit (NEP-413, off chain) |
| `03:near-policy-provider` | `03-owner-wallets/near/02-policy-provider.ts` | provider-rule edit (NEP-366, on chain) |
| `03:evm-create-agent` | `03-owner-wallets/evm/01-create-agent.ts` | EVM owner onboarding (EIP-712) |
| `03:evm-policy-update` | `03-owner-wallets/evm/02-policy-update.ts` | EVM policy edit |
| `04:issue-grant` | `04-grants/01-issue-grant.ts` | token + commitment, `grant_issue` |
| `04:delegate-client` | `04-grants/02-delegate-client.ts` | `forGrant` client, dry swap |
| `04:revoke-and-audit` | `04-grants/03-revoke-and-audit.ts` | `grant_revoke`, containment |
| `05:quote-and-swap` | `05-money-moves/01-quote-and-swap.ts` | dry quote, swap |
| `05:transfer` | `05-money-moves/02-transfer.ts` | transfer to a NEAR Intents account |
| `05:withdraw` | `05-money-moves/03-withdraw.ts` | dry withdraw, withdraw |
| `05:deposit` | `05-money-moves/04-deposit.ts` | deposit address, min amount, memo, expiry |
| `05:private-balance` | `05-money-moves/05-private-balance.ts` | shield / unshield |
| `05:approvals` | `05-money-moves/06-approvals.ts` | `owner_approval`, approval list, `approval_vote` |
| `06:edit-policy` | `06-policy-and-lifecycle/01-edit-policy.ts` | read → modify → sign complete policy |
| `06:freeze` | `06-policy-and-lifecycle/02-freeze-and-unfreeze.ts` | emergency stop, cooldown-aware |
| `06:archive-and-delete` | `06-policy-and-lifecycle/03-archive-and-delete.ts` | archive, restore, delete preview |
| `06:schedule` | `06-policy-and-lifecycle/04-schedule.ts` | weekly hours, `policy_schedule_denied` |
| `07:enable-signing` | `07-identity-signing/01-enable-signing.ts` | owner adds a `sign` recipient (on chain) |
| `07:sign-and-verify` | `07-identity-signing/02-sign-and-verify.ts` | challenge → `sign` → relying-party verification |
| `07:refusals` | `07-identity-signing/03-refusals.ts` | every signing refusal, incl. `intents.near`/`intents.far` |
| `07:disable-signing` | `07-identity-signing/04-disable-signing.ts` | remove one recipient or `sign` entirely |
| `08:error-taxonomy` | `08-errors-and-recovery/01-error-taxonomy.ts` | real error documents |
| `08:status-and-uncertain` | `08-errors-and-recovery/02-status-and-uncertain.ts` | classify a status; when recovery is legal |
| `08:idempotency` | `08-errors-and-recovery/03-idempotency.ts` | replay with the same key |
| `08:recover` | `08-errors-and-recovery/04-recover.ts` | when `/recover` is legal, with the original key and grant |
| `09:reads` / `09:owner-flow` / `09:execution` / `09:sign` | `09-raw-http/*` | the same flows with plain `fetch` (best template for other languages) |
| `10:bff-pattern` | `10-recipes/01-bff-pattern.ts` | browser ↔ backend boundary |
| `10:timelocked-payout` | `10-recipes/02-timelocked-payout.ts` | timelock, scheduled list, cancel |
| `10:ai-assistant` | `10-recipes/03-ai-assistant.ts` | grant per assistant, tool → API mapping |
| `10:full-journey` | `10-recipes/04-full-journey.ts` | create → grant → fund → quote → swap |
| `11:verify-operation` | `11-verify-operations/01-verify-operation.ts` | operation proof and its evidence, `verifyOperationProof` offline |

Useful support modules to copy: `support/sign-near-intent.ts` (server-side NEAR signer:
NEP-413 + NEP-366), `support/evm-owner.ts` (EVM owner descriptor + EIP-712),
`support/policy.ts` (policy builders), `support/destinations.ts`, `support/flow.ts`
(generate → sign → submit → wait), `support/raw-http.ts` (fetch client with JSON:API errors),
`support/identity.ts` (identity challenges and NEP-413 signature verification).

Python and Rust equivalents of the client and signers ship with this skill in `assets/`.
