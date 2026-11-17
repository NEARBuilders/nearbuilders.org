# TypeScript / JavaScript

```bash
npm i @near-intents-agent-api/sdk          # or pnpm add / yarn add / bun add
```

Node 24+ (or any runtime with `fetch` and Web Crypto). The SDK is a thin, typed client generated
from the server's endpoint registry: one method per endpoint, JSON:API errors, no retries, no
wallet signers, **server-side only** (it needs the API key).

## Client

```ts
import { AgentApi, AgentApiError, AgentApiRequestError, createGrantCredential, createIdempotencyKey } from "@near-intents-agent-api/sdk";

const api = new AgentApi({
  apiKey: process.env.NEAR_INTENTS_AGENT_API_KEY!,           // naa_… from the partner dashboard
  baseUrl: process.env.NEAR_INTENTS_AGENT_API_URL,           // optional; defaults to https://api.agentsonintents.com
});

await api.getNetwork();
await api.whoami();
await api.getPartnerQuota();
const tokens = await api.getTokens();          // TokenView[]
```

Options: `baseUrl`, `timeoutMs` (default 150 s for settlement writes, 65 s otherwise),
`maxResponseBytes`, `fetch`, `grantToken`.

## Owner intent loop

```ts
const generated = await api.generateIntent({
  type: "agent_create",
  name: "Trading assistant",
  external_user_id: user.id,
  owner: { type: "near", account_id: "alice.near", public_key: "ed25519:…" },
  policy,
});
// generated: { correlation_id, agent_id, intent: { standard, payload }, preview, expires_at, signer, idempotencyKey }

// → send { correlation_id, intent, preview } to the browser; it returns signed_data
const signed_data = await browserSigns(generated.intent);

await api.submitIntent({ type: generated.type, correlation_id: generated.correlation_id, signed_data });
let status = await api.getStatus(generated.correlation_id, { waitMs: 30_000 });
```

`generateIntent` returns `idempotencyKey`; to retry an interrupted generation pass the same one:
`api.generateIntent(req, { idempotencyKey })`.

Typed narrowing: `GenerateIntentResponseOf<"policy_update">`, `StatusResponseOf<"swap">`.

## Grants

```ts
const { token, commitment } = createGrantCredential();   // store token encrypted first
const g = await api.generateIntent({
  type: "grant_issue", agent_id, label: "assistant-session-42",
  credential: commitment,
  expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
});
// owner signs, submit, wait → status.details.grant.grant_id

const agent = api.forGrant(token);                         // one client per grant
```

## Executions

```ts
const quote = await agent.swap(agentId, {
  origin_asset: "nep141:wrap.near", destination_asset: usdc, amount: "1000000000000000000000000", dry: true,
});                                                          // QuoteResponse, no key

const idempotencyKey = createIdempotencyKey();               // persist with the body first
const op = await agent.swap(agentId, { origin_asset: "nep141:wrap.near", destination_asset: usdc, amount }, { idempotencyKey });
// op: StatusResponseOf<"swap"> & { idempotencyKey }

const deposit = await api.deposit(agentId, { origin_asset: usdcOnBase }, { idempotencyKey: createIdempotencyKey() });
// deposit.details: deposit_address, memo?, min_amount, expires_at, refund_to
```

Also: `withdraw`, `transfer`, `shield`, `unshield`, `recover(agentId, { correlation_id, request }, { idempotencyKey })`.

## Reads

`listAgents({ external_user_id, cursor })`, `getAgent`, `getWallet`, `getBalances(id, { source, asset })`,
`getPolicy`, `getPolicyHistory`, `listGrants`, `listScheduledExecutions`, `getContainment`,
`listApprovals`, `getApproval`, `getAddress(id, "near")`, `listProviderRecords(id, kind)`,
`getHistory(id, { cursor, limit, include_unpaid })`, `getStatus(cid, { waitMs, refresh })`,
`getOperationProof(id, cid)`.

## Identity signing

With a grant, and only for recipients in the policy's `sign.recipients` (never `intents.near` or
`intents.far`), the API signs a canonical identity challenge with the agent's NEAR key (NEP-413):

```ts
const signature = await agent.sign(agentId, { message: canonicalChallengeJson, recipient: "login.example.near" });
// signature: { near_account_id, public_key, signature (hex), nonce (base64), recipient }
```

The challenge format is in [policy.md](policy.md#signing-sign). The relying party verifies the
NEP-413 signature over `message`, `nonce` and `recipient`, and that `public_key` is a full-access
key of `near_account_id`; the examples' `support/identity.ts` does both.

## Operation proofs

```ts
import { NoteError, ProofError, verifyOperationProof } from "@near-intents-agent-api/sdk";

const proof = await api.getOperationProof(agentId, "op_…");          // executions only
const verified = verifyOperationProof(proof, "api.agentsonintents.com/log"); // pin the origin yourself
// verified.proven: [{ index, fields, checkpoint, cosignedAt, evidence }]; verified.pending, verified.unlogged
```

Offline and without trusting the API: each `PROVEN` event hashes to a leaf of a checkpoint signed by
the log key and cosigned by the notary, and names this execution. Its `evidence`, the result it
recorded with any settlement transaction hashes, must hash to the opening's `evidenceHash` and comes
back parsed (`null` when none was served). A proof that does not hold, or altered evidence, throws
`NoteError` or `ProofError`. `PENDING` events wait for the next checkpoint. To tie the keys to
attested code, check the notary's TDX birth quote (`proof.notary.birth`) and compare its
`report_data` with `verified.birthReportData`. A deployment without a log answers
`501 transparency_log_disabled`.

## Errors

```ts
try {
  await agent.withdraw(agentId, req, { idempotencyKey });
} catch (error) {
  if (error instanceof AgentApiError) {
    switch (error.code) {
      case "policy_destination_denied": /* ask owner to allow the address */ break;
      case "spend_budget_exceeded":     /* show remaining budget */ break;
      case "policy_schedule_denied":    /* outside owner hours: same request at error.availableAt */ break;
      case "policy_change_throttled":   /* error.availableAt */ break;
      default: throw error;
    }
  } else if (error instanceof AgentApiRequestError) {
    // transport failure: retry with error.idempotencyKey and the same body
  }
}
```

## Waiting helper

```ts
async function settle(api: AgentApi, cid: string, deadlineMs = 300_000) {
  const end = Date.now() + deadlineMs;
  for (;;) {
    const s = await api.getStatus(cid, { waitMs: 30_000 });
    if (!["PROCESSING", "QUEUED"].includes(s.status) || Date.now() > end) return s;
  }
}
```

## Signing on the server (scripts, tests, company-held owner keys)

NEAR (near-api-js v7) — from the examples' `support/sign-near-intent.ts`:

```ts
import { createHash } from "node:crypto";
import { actions, encodeDelegateAction, encodeSignedDelegate, JsonRpcProvider, KeyPair, Signature } from "near-api-js";

async function signNearIntent(generated, keyPair: KeyPair, rpcUrl: string) {
  const { intent, signer } = generated;
  if (intent.standard === "nep413")
    return { ...intent, public_key: signer.public_key,
             signature: await signNep413(keyPair, { ...intent.payload, nonce: Buffer.from(intent.payload.nonce, "base64") }) };
  const access = await new JsonRpcProvider({ url: rpcUrl }).viewAccessKey({
    accountId: signer.account_id, publicKey: signer.public_key, finalityQuery: { finality: "final" } });
  const delegateAction = {
    senderId: signer.account_id, receiverId: intent.payload.receiverId, publicKey: keyPair.getPublicKey(),
    nonce: access.nonce + 1n, maxBlockHeight: BigInt(access.block_height) + 120n,
    actions: intent.payload.actions.map(({ params }) =>
      actions.functionCall(params.methodName, Buffer.from(JSON.stringify(params.args)), BigInt(params.gas), BigInt(params.deposit))),
  };
  const digest = createHash("sha256").update(encodeDelegateAction(delegateAction)).digest();
  const signature = new Signature({ keyType: 0, data: keyPair.sign(digest).signature });
  return { ...intent, signed_delegate: Buffer.from(encodeSignedDelegate({ delegateAction, signature })).toString("base64") };
}
```

(`encodeDelegateAction` already prepends the NEP-461 prefix. `signNep413` is in the examples'
`support/near-owner.ts`: sha256 of the NEP-413 borsh body, signed with the key pair, base64.)

EVM (viem):

```ts
import { privateKeyToAccount } from "viem/accounts";
const account = privateKeyToAccount(pk);
const owner = { type: "evm", address: account.address.toLowerCase(), chain_id: 1, public_key: `0x${account.publicKey.slice(4)}` };
const signed_data = { ...intent, signature: await account.signTypedData(intent.payload) };
```

Browser signing for all four standards: [owner-intents.md](owner-intents.md#backend-for-frontend-bff-split).

## Next.js / serverless notes

- Keep the SDK in server code only (route handlers, server actions); never import it into a
  client component with the key.
- Long-polls take up to 30 s and executions up to ~2 min: set the function timeout accordingly
  or move polling to a background job / queue.
