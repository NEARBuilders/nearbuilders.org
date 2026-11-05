//! Byte-for-byte checks against near-api-js / viem output.
//! Run: cargo test --features evm   (reads ../test-vectors.json)
use near_intents_agent_api::*;
use serde_json::Value;

fn vectors() -> Option<Value> {
    let path = std::env::var("VECTORS").unwrap_or_else(|_| concat!(env!("CARGO_MANIFEST_DIR"), "/../test-vectors.json").into());
    Some(serde_json::from_str(&std::fs::read_to_string(path).ok()?).unwrap())
}

#[tokio::test]
async fn matches_reference_signers() {
    let Some(v) = vectors() else { return };
    let key = NearKey::from_secret(v["near"]["secret"].as_str().unwrap()).unwrap();
    assert_eq!(key.public_key(), v["near"]["public_key"]);
    let nep413 = sign_nep413(&key, &v["nep413"]["payload"]).unwrap();
    assert_eq!(nep413["signature"], v["nep413"]["signature_b64"]);
    let d = &v["nep366"];
    let nonce: u64 = d["access_key_nonce"].as_str().unwrap().parse().unwrap();
    let height: u64 = d["block_height"].as_str().unwrap().parse().unwrap();
    let signed = sign_delegate(&key, "owner.near", &d["payload"], nonce, height).unwrap();
    assert_eq!(signed, d["signed_delegate"].as_str().unwrap());
    #[cfg(feature = "evm")]
    {
        let e = &v["eip712"];
        let sig = sign_eip712(e["private_key"].as_str().unwrap(), &e["payload"]).await.unwrap();
        assert_eq!(sig["signature"], e["signature"]);
    }
    assert_eq!(grant_commitment(v["grant"]["token"].as_str().unwrap()), v["grant"]["commitment"]);
    let (token, commitment) = create_grant_credential();
    assert_eq!(token.len(), 47);
    assert_eq!(grant_commitment(&token), commitment);
}
