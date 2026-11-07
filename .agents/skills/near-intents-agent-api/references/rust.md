# Rust

No crate is published. Copy [../assets/rust/](../assets/rust/) into your workspace (or vendor
`src/lib.rs` into an existing crate and merge the dependencies from `Cargo.toml`).

```bash
cd assets/rust
cargo test                    # NEAR + grant vectors
cargo test --features evm     # + EIP-712 vector (pulls in alloy)
```

Key dependencies: `reqwest` (rustls), `serde_json` **with `preserve_order`** (required: NEP-366
args must be serialized in the API's key order), `ed25519-dalek`, `sha2`, `bs58`, `base64`;
optional `alloy-*` behind feature `evm`.

## Client

```rust
use near_intents_agent_api::{AgentApi, Error, create_idempotency_key};
use serde_json::json;

let api = AgentApi::from_env()?;                    // NEAR_INTENTS_AGENT_API_KEY, NEAR_INTENTS_AGENT_API_URL (default hosted)
// or AgentApi::new("naa_…", None)?

let network = api.get_network().await?;
let tokens = api.get_tokens().await?;
let agent = api.get_agent(&agent_id).await?;
let policy = api.get_policy(&agent_id).await?;
let balances = api.get_balances(&agent_id, "public").await?;
```

Bodies and responses are `serde_json::Value`. For anything without a helper use
`api.request(Method, path, query, body, idempotency_key, grant)`. Generate typed models from
`/openapi.json` (e.g. `openapi-generator -g rust` or `progenitor`) if you want structs; keep
`intent.payload` as `Value` either way so you never re-order it.

## Owner flow

```rust
use near_intents_agent_api::{NearKey, sign_intent};

let key = NearKey::from_secret(&std::env::var("AGENT_OWNER_PRIVATE_KEY")?)?;
let owner = json!({ "type": "near", "account_id": account_id, "public_key": key.public_key() });

let generated = api.generate_intent(&json!({
    "type": "agent_create", "name": "Treasury bot", "owner": owner, "policy": policy
}), &create_idempotency_key()).await?;

let signed = sign_intent(&generated, Some(&key), "https://free.rpc.fastnear.com", None).await?;
let cid = generated["correlation_id"].as_str().unwrap();
api.submit_intent(generated["type"].as_str().unwrap(), cid, signed).await?;
let status = api.wait_for_status(cid, std::time::Duration::from_secs(300)).await?;
```

EVM owner (feature `evm`): `sign_intent(&generated, None, "", Some(&evm_private_key_hex))`.
Passkeys can only be signed in a browser.

## Grant and execute

```rust
use near_intents_agent_api::create_grant_credential;

let (token, commitment) = create_grant_credential();      // store token encrypted
// grant_issue with "credential": commitment … owner signs … wait SUCCESS

let agent = api.for_grant(token)?;
let quote = agent.quote_swap(&agent_id, json!({
    "origin_asset": "nep141:wrap.near", "destination_asset": usdc, "amount": "100000000000000000000000"
})).await?;

let key = create_idempotency_key();                        // persist with the body first
let op = agent.execute(&agent_id, "swap", &json!({
    "origin_asset": "nep141:wrap.near", "destination_asset": usdc, "amount": "100000000000000000000000"
}), &key).await?;
let final_status = api.wait_for_status(op["correlation_id"].as_str().unwrap(), std::time::Duration::from_secs(300)).await?;
```

`execute` covers `swap`, `withdraw`, `transfer`, `shield`, `unshield`; `deposit` has its own
method (no grant).

## Errors

```rust
match agent.execute(&agent_id, "withdraw", &body, &key).await {
    Ok(op) => track(op),
    Err(Error::Api { code, available_at, .. }) if code == "spend_budget_exceeded" => {
        /* show remaining budget; retry after `available_at` with a NEW key */
    }
    Err(e) if e.code() == Some("policy_destination_denied") => { /* ask the owner to allow it */ }
    Err(Error::Transport { idempotency_key, .. }) => {
        /* outcome unknown: retry with the same key and body */
    }
    Err(e) => return Err(e.into()),
}
```

`Error::Api { status, code, title, detail, retryable, available_at, request_id, errors, idempotency_key }`,
`Error::Transport { source, idempotency_key }`, `Error::Invalid(String)`.

## Pitfalls

- Without `preserve_order`, `serde_json::Map` is a `BTreeMap` and sorts keys: NEP-366 args
  bytes change and the API rejects the signature.
- Use `u128` (or strings) for amounts; 24-decimal NEAR amounts overflow `u64`.
- The crate allows `clippy::result_large_err` on purpose (errors carry the full document).
