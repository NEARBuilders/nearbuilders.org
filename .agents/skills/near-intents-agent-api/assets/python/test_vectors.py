"""
Checks the Python signers against ../test-vectors.json (generated with near-api-js and viem).

    python test_vectors.py                 # NEAR + grant vectors; EIP-712 too if eth-account is installed
    python test_vectors.py path/to/vectors.json
"""

import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import near_intents_agent_api as n  # noqa: E402

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "test-vectors.json"
v = json.loads(path.read_text())

key = n.NearKey(v["near"]["secret"])
assert key.public_key == v["near"]["public_key"], "public key"

assert n.sign_nep413(key, v["nep413"]["payload"])["signature"] == v["nep413"]["signature_b64"], "nep413"

d = v["nep366"]
nonce, height = int(d["access_key_nonce"]), int(d["block_height"])
encoded = n.encode_delegate_action(v["near"]["account_id"], d["payload"], key.public_bytes, nonce + 1, height + 120)
assert (struct.pack("<I", n.NEP366_TAG) + encoded).hex() == d["encoded_hex"], "delegate action bytes"
assert n.sign_delegate(key, v["near"]["account_id"], d["payload"], nonce, height) == d["signed_delegate"], "signed_delegate"

assert n.grant_commitment(v["grant"]["token"]) == v["grant"]["commitment"], "grant commitment"
assert n.GRANT_TOKEN_PATTERN.match(n.create_grant_credential()["token"]), "grant token format"
assert n.to_atomic("1.5", 6) == "1500000" and n.to_decimal("1234567", 6) == "1.234567", "amounts"

try:
    import eth_account  # noqa: F401
except ImportError:
    print("NEAR and grant vectors match (eth-account not installed: EIP-712 skipped)")
    sys.exit(0)

e = v["eip712"]
assert n.sign_eip712(e["private_key"], e["payload"])["signature"] == e["signature"], "eip712"
owner = n.evm_owner(e["private_key"])
assert owner["address"] == e["address"] and owner["public_key"] == e["public_key"], "evm owner"
print("All vectors match")
