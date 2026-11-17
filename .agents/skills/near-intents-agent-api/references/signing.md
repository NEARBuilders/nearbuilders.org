# Signing owner intents

The owner's wallet signs `intent.payload` exactly as `generate-intent` returned it, using the
method named by `intent.standard`. You submit `signed_data = { ...intent, <wallet output> }`.

In a product, **the owner's wallet in the browser signs** and your backend only forwards bytes.
Server-side signers (below) exist for scripts, tests, CI, and integrations where the company
deliberately operates the owner key (see [architecture.md](architecture.md#key-ownership-models)).

Never: rebuild the payload, re-serialize it with different key order, hash it yourself before a
wallet that hashes again, sign with a function-call key, or guess the standard from the type.

All byte formats below are pinned by [../assets/test-vectors.json](../assets/test-vectors.json),
generated with near-api-js and viem. Any new port must reproduce every vector.

## nep413 — off-chain NEAR message

Payload: `{ message: string, recipient: string, nonce: base64(32 bytes) }`.

```text
tag    = u32_le(2^31 + 413)                       # 0x9d 0x01 0x00 0x80
body   = borsh_string(message)                    # u32_le(len(utf8)) || utf8
       || nonce_bytes[32]                         # raw, decoded from base64 (fixed array: no length)
       || borsh_string(recipient)
       || 0x00                                    # callbackUrl: Option<String> = None
digest = sha256(tag || body)
sig    = ed25519_sign(owner_secret, digest)
signed_data = { ...intent, public_key: "ed25519:<base58 pubkey>", signature: base64(sig) }
```

Browser wallets: `wallet.signMessage({ message, recipient, nonce: Uint8Array })` — decode the
base64 nonce to bytes first. The key must be a **FullAccess** key of `signer.account_id`
(otherwise `owner_key_not_full_access`).

## nep366 — gasless NEAR delegate action (on chain)

Payload: `{ receiverId, actions: [ { type: "FunctionCall", params: { methodName, args, gas, deposit } } ] }`
(1–2 actions; `args` is a JSON object; `gas` and `deposit` are decimal strings).

The signer needs chain state: query the owner's access key (`view_access_key`, finality
`final`) on a NEAR mainnet RPC (e.g. `https://free.rpc.fastnear.com`,
`https://rpc.mainnet.near.org`).

```text
nonce            = access_key.nonce + 1
max_block_height = access_key_query.block_height + 120          # ~2 minutes

DelegateAction (borsh) =
    borsh_string(sender_id = signer.account_id)
 || borsh_string(receiverId)
 || u32_le(len(actions))
 || for each action:
        0x02                                                    # Action::FunctionCall
     || borsh_string(methodName)
     || u32_le(len(argsBytes)) || argsBytes                     # argsBytes = JSON.stringify(args) as UTF-8
     || u64_le(gas)
     || u128_le(deposit)
 || u64_le(nonce)
 || u64_le(max_block_height)
 || 0x00 || pubkey[32]                                          # PublicKey::ED25519

digest          = sha256(u32_le(2^30 + 366) || DelegateAction)  # NEP-461 prefix 0x6e 0x01 0x00 0x40
signature       = ed25519_sign(owner_secret, digest)
SignedDelegate  = DelegateAction || 0x00 || signature[64]        # Signature::ED25519
signed_data     = { ...intent, signed_delegate: base64(SignedDelegate) }
```

**The args trap.** The API compares the base64 of `argsBytes` against what it generated, so
`argsBytes` must equal JavaScript `JSON.stringify(args)`: keys in the order received, no spaces,
non-ASCII characters as raw UTF-8 (not `\uXXXX`), integers without `.0`. In practice:

| Language | Do |
|---|---|
| Python | `json.loads` keeps order; `json.dumps(args, separators=(",", ":"), ensure_ascii=False).encode()` |
| Rust | `serde_json` with feature **`preserve_order`**, then `serde_json::to_vec(&args)` |
| Go | decode into an ordered structure (e.g. keep `json.RawMessage` of `args` and compact it with `json.Compact`), never `map[string]any` (Go sorts map keys) |
| Java/Kotlin | Jackson `ObjectMapper` reading into `JsonNode` keeps order; write without pretty printing; disable `ESCAPE_NON_ASCII` |
| C# | `System.Text.Json` `JsonNode` keeps order; use `JavaScriptEncoder.UnsafeRelaxedJsonEscaping` so non-ASCII is not escaped |

The simplest robust approach in any language: keep `args` as the raw JSON bytes from the
response and minify them without reordering.

Browser wallets: `wallet.signDelegateActions({ delegateActions: [intent.payload] })` and submit
`signedDelegateActions[0]`. The API's sponsor relays it; the owner pays no gas.

`policy_delegate_signature_invalid` / `intent_payload_mismatch` on nep366 almost always means args bytes,
nonce (stale access-key read: use finality `final` and sign right away) or the wrong key.

## eip712 — EVM owners

Payload is a complete typed-data document: `{ types: { EIP712Domain: [...], <Primary>: [...] }, primaryType, domain, message }`.
Domain is `{ name: "NEAR Wallet Contract", version: "1" }` (no chainId / verifyingContract);
`primaryType` is `Authorization` or `WalletMessage`.

```text
signature   = secp256k1_sign(eip712_hash(payload))   # standard eth_signTypedData_v4
signed_data = { ...intent, signature: "0x" + r(32) + s(32) + v(1) }   # 130 hex chars
```

| Language | Call |
|---|---|
| Browser | viem `walletClient.signTypedData({ account, ...payload })` / `eth_signTypedData_v4` |
| TypeScript server | viem `privateKeyToAccount(pk).signTypedData(payload)` |
| Python | `Account.sign_message(encode_typed_data(full_message=payload), private_key=pk)` (eth-account ≥0.13) |
| Rust | alloy `TypedData` (from the JSON) → `eip712_signing_hash()` → `PrivateKeySigner::sign_hash` |
| Go | go-ethereum `apitypes.TypedDataAndHash(typedData)` → `crypto.Sign`, then add 27 to `v` |

Owner descriptor for creation: `{ type: "evm", address: lowercase, chain_id: 1,
public_key: "0x" + uncompressed point without the 04 prefix (128 hex) }`. EOAs only.

KMS/HSM keys (AWS KMS, GCP KMS, Fireblocks raw signing) work: compute the EIP-712 digest
locally, have the KMS sign the 32-byte digest, normalize `s` to low-S, derive `v` by recovery.

## webauthn — passkey owners

Payload is WebAuthn request options: `{ challenge, rpId, allowCredentials, userVerification: "required", timeout }`.
Only the user's authenticator can sign:

```ts
import { startAuthentication } from "@simplewebauthn/browser";
const credential = await startAuthentication({ optionsJSON: intent.payload });
signed_data = { ...intent, credential };
```

Registration: ES256 (`alg: -7`), user verification required; store the credential id and the
**SPKI DER** public key (base64url), `rp_id` and exact `origin`. Convert COSE keys to SPKI in
your backend. Cross-origin iframes are rejected.

## Server-side signer implementations in this skill

| Language | File | Functions |
|---|---|---|
| TypeScript | examples repo `support/sign-near-intent.ts`, `support/evm-owner.ts` | `signNearIntent`, `signEvmIntent` (near-api-js, viem) |
| Python | [../assets/python/near_intents_agent_api.py](../assets/python/near_intents_agent_api.py) | `sign_intent`, `sign_nep413`, `sign_nep366`, `sign_delegate`, `sign_eip712`, `NearKey` |
| Rust | [../assets/rust/src/lib.rs](../assets/rust/src/lib.rs) | `sign_intent`, `sign_nep413`, `sign_nep366`, `sign_delegate`, `sign_eip712` (feature `evm`), `NearKey` |

NEAR secret key format everywhere: `ed25519:<base58(seed32 || pubkey32)>` (near-cli /
near-api-js key files). Public key: `ed25519:<base58(pubkey32)>`.

## Verifying a port

1. Load `test-vectors.json`.
2. `NearKey(near.secret).public_key == near.public_key`.
3. `sign_nep413(near, nep413.payload).signature == nep413.signature_b64` (ed25519 is deterministic).
4. `hex(encode_delegate_action(...))` with `access_key_nonce + 1` and `block_height + 120`,
   prefixed by the NEP-461 tag, `== nep366.encoded_hex`; `signed_delegate` matches.
5. EIP-712 signature over `eip712.payload` with `eip712.private_key` `== eip712.signature`.
6. `sha256_hex(grant.token) == grant.commitment`.

Python: `python assets/python/test_vectors.py`. Rust: `cargo test --features evm` in
`assets/rust`.
