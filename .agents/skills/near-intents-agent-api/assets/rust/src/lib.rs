//! Reference Rust client for the NEAR Intents Agent API, plus owner-side signers.
//!
//! Copy this crate (or the parts you need) into your project. It mirrors the TypeScript SDK:
//! a thin HTTP layer, JSON:API errors, explicit idempotency keys, one client per grant, no
//! automatic retries. Request and response bodies are `serde_json::Value`; generate typed
//! models from `GET /openapi.json` if you want them.
//!
//! Backend only: the API key (`naa_…`) and grant tokens (`ngt_…`) never reach a browser.
//!
//! The signers (`sign_nep413`, `sign_nep366`, `sign_eip712`) are for scripts, tests and
//! server-held owner keys. In a real product the owner's wallet signs in the browser; your
//! backend forwards `intent` to the frontend and the wallet output back to `submit_intent`.

#![allow(clippy::result_large_err)] // the error carries the full JSON:API document on purpose

use std::time::{Duration, Instant};

use base64::engine::general_purpose::{STANDARD as B64, URL_SAFE_NO_PAD as B64URL};
use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use rand::RngCore;
use reqwest::Method;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub const DEFAULT_BASE_URL: &str = "https://api.agentsonintents.com";
const NEP413_TAG: u32 = (1 << 31) + 413;
const NEP366_TAG: u32 = (1 << 30) + 366;

// ------------------------------------------------------------------------------------ errors

#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// Non-2xx response. Branch on `code`, never on `title`.
    #[error("{status} {code}: {title}")]
    Api {
        status: u16,
        code: String,
        title: String,
        detail: Option<String>,
        retryable: bool,
        available_at: Option<String>,
        request_id: Option<String>,
        errors: Vec<Value>,
        idempotency_key: Option<String>,
    },
    /// Transport failure. A write may still have reached the API: reconcile the original
    /// operation, and retry only with the same idempotency key.
    #[error("transport: {source}")]
    Transport {
        #[source]
        source: reqwest::Error,
        idempotency_key: Option<String>,
    },
    #[error("{0}")]
    Invalid(String),
}

impl Error {
    pub fn code(&self) -> Option<&str> {
        match self {
            Error::Api { code, .. } => Some(code),
            _ => None,
        }
    }
}

pub type Result<T> = std::result::Result<T, Error>;

// ----------------------------------------------------------------------------------- helpers

/// One key per logical request. Persist it with the request BEFORE sending.
pub fn create_idempotency_key() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// SHA-256 hex of a grant token: the `credential` of a `grant_issue` intent.
pub fn grant_commitment(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

/// A new grant token (`ngt_` + 32 random bytes, unpadded base64url) and its commitment.
/// Store the token encrypted; the API only ever sees the commitment.
pub fn create_grant_credential() -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = format!("ngt_{}", B64URL.encode(bytes));
    let commitment = grant_commitment(&token);
    (token, commitment)
}

fn valid_token(value: &str, prefix: &str) -> bool {
    value.len() == 47
        && value.starts_with(prefix)
        && value[4..].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

// ------------------------------------------------------------------------------------ client

#[derive(Clone)]
pub struct AgentApi {
    http: reqwest::Client,
    base_url: String,
    api_key: String,
    grant_token: Option<String>,
}

impl AgentApi {
    pub fn new(api_key: impl Into<String>, base_url: Option<&str>) -> Result<Self> {
        let api_key = api_key.into();
        if !valid_token(&api_key, "naa_") {
            return Err(Error::Invalid("api_key is not a naa_ key".into()));
        }
        let http = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|source| Error::Transport { source, idempotency_key: None })?;
        Ok(Self {
            http,
            base_url: base_url.unwrap_or(DEFAULT_BASE_URL).trim_end_matches('/').to_string(),
            api_key,
            grant_token: None,
        })
    }

    pub fn from_env() -> Result<Self> {
        let key = std::env::var("NEAR_INTENTS_AGENT_API_KEY").map_err(|_| Error::Invalid("NEAR_INTENTS_AGENT_API_KEY missing".into()))?;
        let url = std::env::var("NEAR_INTENTS_AGENT_API_URL").ok();
        Self::new(key, url.as_deref())
    }

    /// A client that sends `X-Grant-Token` on delegated calls. One per session/assistant/bot.
    pub fn for_grant(&self, grant_token: impl Into<String>) -> Result<Self> {
        let grant_token = grant_token.into();
        if !valid_token(&grant_token, "ngt_") {
            return Err(Error::Invalid("grant_token is not an ngt_ token".into()));
        }
        Ok(Self { grant_token: Some(grant_token), ..self.clone() })
    }

    pub async fn request(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        body: Option<&Value>,
        idempotency_key: Option<&str>,
        grant: bool,
    ) -> Result<Value> {
        let dry = body.and_then(|b| b.get("dry")).and_then(Value::as_bool).unwrap_or(false);
        let settlement = ["/swap", "/withdraw", "/transfer", "/shield", "/unshield"]
            .iter()
            .any(|suffix| path.ends_with(suffix))
            && !dry;
        let mut request = self
            .http
            .request(method, format!("{}{}", self.base_url, path))
            .query(query)
            .header("accept", "application/json")
            .header("x-api-key", &self.api_key)
            .timeout(Duration::from_secs(if settlement { 150 } else { 65 }));
        if let Some(body) = body {
            request = request.json(body);
        }
        if let Some(key) = idempotency_key {
            request = request.header("idempotency-key", key);
        }
        if grant {
            let token = self
                .grant_token
                .as_deref()
                .ok_or_else(|| Error::Invalid("this call needs a grant: use for_grant(token)".into()))?;
            request = request.header("x-grant-token", token);
        }
        let transport = |source| Error::Transport { source, idempotency_key: idempotency_key.map(String::from) };
        let response = request.send().await.map_err(transport)?;
        let status = response.status().as_u16();
        let bytes = response.bytes().await.map_err(transport)?;
        let document: Value = if bytes.is_empty() { Value::Null } else { serde_json::from_slice(&bytes).unwrap_or(Value::Null) };
        if status >= 400 {
            let first = &document["errors"][0];
            return Err(Error::Api {
                status,
                code: first["code"].as_str().unwrap_or("http_error").into(),
                title: first["title"].as_str().unwrap_or("HTTP error").into(),
                detail: first["detail"].as_str().map(String::from),
                retryable: first["meta"]["retryable"].as_bool().unwrap_or(false),
                available_at: first["meta"]["available_at"].as_str().map(String::from),
                request_id: document["meta"]["request_id"].as_str().map(String::from),
                errors: document["errors"].as_array().cloned().unwrap_or_default(),
                idempotency_key: idempotency_key.map(String::from),
            });
        }
        Ok(document)
    }

    async fn get(&self, path: &str, query: &[(&str, String)]) -> Result<Value> {
        self.request(Method::GET, path, query, None, None, false).await
    }

    // -- owner intents ------------------------------------------------------------------------

    pub async fn generate_intent(&self, request: &Value, idempotency_key: &str) -> Result<Value> {
        self.request(Method::POST, "/v1/generate-intent", &[], Some(request), Some(idempotency_key), false).await
    }

    pub async fn submit_intent(&self, intent_type: &str, correlation_id: &str, signed_data: Value) -> Result<Value> {
        let body = json!({ "type": intent_type, "correlation_id": correlation_id, "signed_data": signed_data });
        self.request(Method::POST, "/v1/submit-intent", &[], Some(&body), None, false).await
    }

    pub async fn get_status(&self, correlation_id: &str, wait_ms: Option<u32>) -> Result<Value> {
        let mut query = vec![("correlation_id", correlation_id.to_string())];
        if let Some(wait) = wait_ms {
            query.push(("wait_ms", wait.to_string()));
        }
        self.get("/v1/status", &query).await
    }

    /// Long-polls until the operation stops moving (anything but PROCESSING/QUEUED).
    /// UNCERTAIN: keep observing the same id; never resubmit under a new key.
    pub async fn wait_for_status(&self, correlation_id: &str, deadline: Duration) -> Result<Value> {
        let end = Instant::now() + deadline;
        loop {
            let status = self.get_status(correlation_id, Some(30_000)).await?;
            let moving = matches!(status["status"].as_str(), Some("PROCESSING" | "QUEUED"));
            if !moving || Instant::now() > end {
                return Ok(status);
            }
        }
    }

    // -- reads ---------------------------------------------------------------------------------

    pub async fn get_network(&self) -> Result<Value> {
        self.get("/v1/network", &[]).await
    }
    pub async fn get_tokens(&self) -> Result<Value> {
        Ok(self.get("/v1/tokens", &[]).await?["data"].take())
    }
    pub async fn whoami(&self) -> Result<Value> {
        self.get("/v1/whoami", &[]).await
    }
    pub async fn get_agent(&self, agent_id: &str) -> Result<Value> {
        self.get(&format!("/v1/agents/{agent_id}"), &[]).await
    }
    pub async fn get_policy(&self, agent_id: &str) -> Result<Value> {
        self.get(&format!("/v1/agents/{agent_id}/policy"), &[]).await
    }
    pub async fn get_balances(&self, agent_id: &str, source: &str) -> Result<Value> {
        self.get(&format!("/v1/agents/{agent_id}/balances"), &[("source", source.into())]).await
    }

    // -- executions -----------------------------------------------------------------------------

    /// Dry quote: no grant, no idempotency key, no budget charge.
    pub async fn quote_swap(&self, agent_id: &str, mut request: Value) -> Result<Value> {
        request["dry"] = json!(true);
        self.request(Method::POST, &format!("/v1/agents/{agent_id}/swap"), &[], Some(&request), None, false).await
    }

    /// `action`: swap | withdraw | transfer | shield | unshield | recover. Needs `for_grant`.
    pub async fn execute(&self, agent_id: &str, action: &str, request: &Value, idempotency_key: &str) -> Result<Value> {
        let path = format!("/v1/agents/{agent_id}/{action}");
        self.request(Method::POST, &path, &[], Some(request), Some(idempotency_key), true).await
    }

    /// Inbound deposit address: API key + Idempotency-Key only, no grant.
    pub async fn deposit(&self, agent_id: &str, request: &Value, idempotency_key: &str) -> Result<Value> {
        let path = format!("/v1/agents/{agent_id}/deposit");
        self.request(Method::POST, &path, &[], Some(request), Some(idempotency_key), false).await
    }
}

// ------------------------------------------------------------------------------ NEAR signing
// Exact byte formats; verified against near-api-js. Never rebuild or reorder a payload.

/// A NEAR ed25519 key from `ed25519:<base58(seed || public)>` (near-cli / near-api-js format).
pub struct NearKey {
    signing: SigningKey,
}

impl NearKey {
    pub fn from_secret(secret: &str) -> Result<Self> {
        let raw = bs58::decode(secret.trim_start_matches("ed25519:"))
            .into_vec()
            .map_err(|e| Error::Invalid(e.to_string()))?;
        let seed: [u8; 32] = raw.get(..32).and_then(|s| s.try_into().ok()).ok_or_else(|| Error::Invalid("bad key".into()))?;
        Ok(Self { signing: SigningKey::from_bytes(&seed) })
    }
    pub fn public_bytes(&self) -> [u8; 32] {
        self.signing.verifying_key().to_bytes()
    }
    pub fn public_key(&self) -> String {
        format!("ed25519:{}", bs58::encode(self.public_bytes()).into_string())
    }
    fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.signing.sign(message).to_bytes()
    }
}

fn borsh_string(out: &mut Vec<u8>, value: &str) {
    out.extend((value.len() as u32).to_le_bytes());
    out.extend(value.as_bytes());
}

fn str_field<'a>(value: &'a Value, name: &str) -> Result<&'a str> {
    value[name].as_str().ok_or_else(|| Error::Invalid(format!("payload.{name} missing")))
}

fn u_field(value: &Value, name: &str) -> Result<u128> {
    str_field(value, name)?.parse().map_err(|_| Error::Invalid(format!("{name} is not an integer")))
}

/// NEP-413 signature for an `nep413` payload. Returns `{ public_key, signature }`.
pub fn sign_nep413(key: &NearKey, payload: &Value) -> Result<Value> {
    let nonce = B64.decode(str_field(payload, "nonce")?).map_err(|e| Error::Invalid(e.to_string()))?;
    if nonce.len() != 32 {
        return Err(Error::Invalid("nonce must be 32 bytes".into()));
    }
    let mut body = NEP413_TAG.to_le_bytes().to_vec();
    borsh_string(&mut body, str_field(payload, "message")?);
    body.extend(&nonce);
    borsh_string(&mut body, str_field(payload, "recipient")?);
    body.push(0); // callbackUrl: None
    let signature = key.sign(&Sha256::digest(&body));
    Ok(json!({ "public_key": key.public_key(), "signature": B64.encode(signature) }))
}

/// Borsh `DelegateAction` (without the NEP-461 prefix) for an `nep366` payload.
pub fn encode_delegate_action(
    sender_id: &str,
    payload: &Value,
    public_key: &[u8; 32],
    nonce: u64,
    max_block_height: u64,
) -> Result<Vec<u8>> {
    let actions = payload["actions"].as_array().ok_or_else(|| Error::Invalid("payload.actions missing".into()))?;
    let mut out = Vec::new();
    borsh_string(&mut out, sender_id);
    borsh_string(&mut out, str_field(payload, "receiverId")?);
    out.extend((actions.len() as u32).to_le_bytes());
    for action in actions {
        let params = &action["params"];
        out.push(2); // Action::FunctionCall
        borsh_string(&mut out, str_field(params, "methodName")?);
        // Same bytes as JavaScript JSON.stringify(args): compact, key order preserved.
        let args = serde_json::to_vec(&params["args"]).map_err(|e| Error::Invalid(e.to_string()))?;
        out.extend((args.len() as u32).to_le_bytes());
        out.extend(args);
        out.extend((u_field(params, "gas")? as u64).to_le_bytes());
        out.extend(u_field(params, "deposit")?.to_le_bytes());
    }
    out.extend(nonce.to_le_bytes());
    out.extend(max_block_height.to_le_bytes());
    out.push(0); // KeyType::ED25519
    out.extend(public_key);
    Ok(out)
}

/// Base64 borsh `SignedDelegate`, given the owner's access-key nonce and the latest block height.
pub fn sign_delegate(key: &NearKey, sender_id: &str, payload: &Value, access_key_nonce: u64, block_height: u64) -> Result<String> {
    let action = encode_delegate_action(sender_id, payload, &key.public_bytes(), access_key_nonce + 1, block_height + 120)?;
    let mut prefixed = NEP366_TAG.to_le_bytes().to_vec();
    prefixed.extend(&action);
    let signature = key.sign(&Sha256::digest(&prefixed));
    let mut signed = action;
    signed.push(0); // KeyType::ED25519
    signed.extend(signature);
    Ok(B64.encode(signed))
}

/// NEP-366 delegate action for an `nep366` payload. Returns `{ signed_delegate }`.
pub async fn sign_nep366(key: &NearKey, account_id: &str, payload: &Value, rpc_url: &str) -> Result<Value> {
    let body = json!({
        "jsonrpc": "2.0", "id": "access-key", "method": "query",
        "params": { "request_type": "view_access_key", "finality": "final",
                    "account_id": account_id, "public_key": key.public_key() }
    });
    let rpc: Value = reqwest::Client::new()
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|source| Error::Transport { source, idempotency_key: None })?
        .json()
        .await
        .map_err(|source| Error::Transport { source, idempotency_key: None })?;
    let result = &rpc["result"];
    let (Some(nonce), Some(height)) = (result["nonce"].as_u64(), result["block_height"].as_u64()) else {
        return Err(Error::Invalid(format!("view_access_key failed: {rpc}")));
    };
    Ok(json!({ "signed_delegate": sign_delegate(key, account_id, payload, nonce, height)? }))
}

/// EIP-712 signature (0x + 65 bytes) for an `eip712` payload. The payload includes `EIP712Domain`.
#[cfg(feature = "evm")]
pub async fn sign_eip712(private_key_hex: &str, payload: &Value) -> Result<Value> {
    use alloy_signer::Signer as _;
    let typed: alloy_dyn_abi::TypedData = serde_json::from_value(payload.clone()).map_err(|e| Error::Invalid(e.to_string()))?;
    let hash = typed.eip712_signing_hash().map_err(|e| Error::Invalid(e.to_string()))?;
    let signer: alloy_signer_local::PrivateKeySigner = private_key_hex.parse().map_err(|e: alloy_signer_local::LocalSignerError| Error::Invalid(e.to_string()))?;
    let signature = signer.sign_hash(&hash).await.map_err(|e| Error::Invalid(e.to_string()))?;
    Ok(json!({ "signature": format!("0x{}", hex::encode(signature.as_bytes())) }))
}

/// `signed_data` for a `generate-intent` response, chosen by `intent.standard`.
/// `webauthn` (passkeys) can only be signed by the owner's authenticator in a browser.
pub async fn sign_intent(generated: &Value, near_key: Option<&NearKey>, rpc_url: &str, evm_key: Option<&str>) -> Result<Value> {
    let intent = &generated["intent"];
    let payload = &intent["payload"];
    let extra = match intent["standard"].as_str() {
        Some("nep413") => sign_nep413(near_key.ok_or_else(|| Error::Invalid("nep413 needs the NEAR key".into()))?, payload)?,
        Some("nep366") => {
            let key = near_key.ok_or_else(|| Error::Invalid("nep366 needs the NEAR key".into()))?;
            sign_nep366(key, str_field(&generated["signer"], "account_id")?, payload, rpc_url).await?
        }
        #[cfg(feature = "evm")]
        Some("eip712") => sign_eip712(evm_key.ok_or_else(|| Error::Invalid("eip712 needs the EVM key".into()))?, payload).await?,
        other => return Err(Error::Invalid(format!("cannot sign {other:?} here (evm_key: {})", evm_key.is_some()))),
    };
    let mut signed = intent.clone();
    for (name, value) in extra.as_object().into_iter().flatten() {
        signed[name] = value.clone();
    }
    Ok(signed)
}
