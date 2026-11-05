"""
Minimal Python client for the NEAR Intents Agent API, plus owner-side signers.

Copy this file into your project. It mirrors the TypeScript SDK (`@near-intents-agent-api/sdk`):
one thin HTTP layer, JSON:API errors, explicit idempotency keys, per-grant clients. It contains no
retries and no hidden state.

    pip install httpx cryptography          # client + NEAR signing
    pip install eth-account                 # only for EVM (EIP-712) owners

Backend only: the API key (`naa_...`) and grant tokens (`ngt_...`) never go to a browser.

Signing helpers (`sign_nep413`, `sign_nep366`, `sign_eip712`) exist for scripts, tests and
server-held owner keys. In a real product the OWNER's wallet signs in the browser; your backend
only forwards `intent` to the frontend and the wallet output back to `submit_intent`.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import secrets
import struct
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Iterable

import httpx

DEFAULT_BASE_URL = "https://api.agentsonintents.com"
API_KEY_PATTERN = re.compile(r"^naa_[A-Za-z0-9_-]{43}$")
GRANT_TOKEN_PATTERN = re.compile(r"^ngt_[A-Za-z0-9_-]{43}$")
SETTLEMENT_PATHS = ("/swap", "/withdraw", "/transfer", "/shield", "/unshield")
STILL_MOVING = {"PROCESSING", "QUEUED"}


# ------------------------------------------------------------------------------------- errors


class AgentApiError(Exception):
    """A non-2xx response. Branch on `code`, never on `title`."""

    def __init__(self, status: int, document: Any, idempotency_key: str | None):
        errors = document.get("errors", []) if isinstance(document, dict) else []
        first = errors[0] if errors else {}
        meta = first.get("meta") or {}
        self.status = status
        self.code: str = first.get("code", "http_error")
        self.title: str = first.get("title", f"HTTP {status}")
        self.detail: str | None = first.get("detail")
        self.retryable: bool = bool(meta.get("retryable", False))
        self.available_at: str | None = meta.get("available_at")
        self.request_id: str | None = (document.get("meta") or {}).get("request_id") if isinstance(document, dict) else None
        self.errors: list[dict[str, Any]] = errors
        self.idempotency_key = idempotency_key
        super().__init__(f"{status} {self.code}: {self.detail or self.title}")


class AgentApiRequestError(Exception):
    """Transport failure. A write may still have reached the API: reconcile before retrying,
    and retry only with the same `idempotency_key`."""

    def __init__(self, cause: Exception, idempotency_key: str | None):
        super().__init__(str(cause))
        self.__cause__ = cause
        self.idempotency_key = idempotency_key


# ------------------------------------------------------------------------------------ helpers


def create_idempotency_key() -> str:
    """One key per logical request. Persist it with the request BEFORE sending."""
    return str(uuid.uuid4())


def grant_commitment(token: str) -> str:
    """SHA-256 hex of the grant token: the `credential` field of a `grant_issue` intent."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_grant_credential() -> dict[str, str]:
    """New grant token (`ngt_` + 32 random bytes, unpadded base64url) and its commitment.
    Store the token encrypted on your backend; the API never sees it."""
    token = "ngt_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    return {"token": token, "commitment": grant_commitment(token)}


def to_atomic(amount: str, decimals: int) -> str:
    """'1.5' with 6 decimals -> '1500000'. Never use floats for money."""
    whole, _, fraction = amount.partition(".")
    if len(fraction) > decimals:
        raise ValueError(f"amount has more than {decimals} decimals")
    return str(int((whole or "0") + fraction.ljust(decimals, "0")))


def to_decimal(amount_raw: str, decimals: int) -> str:
    padded = amount_raw.rjust(decimals + 1, "0")
    whole, fraction = padded[: len(padded) - decimals] or "0", padded[len(padded) - decimals :]
    return whole if decimals == 0 else f"{whole}.{fraction}".rstrip("0").rstrip(".")


# ------------------------------------------------------------------------------------- client


@dataclass
class AgentApi:
    api_key: str
    base_url: str = DEFAULT_BASE_URL
    grant_token: str | None = None
    timeout_s: float = 65.0
    settlement_timeout_s: float = 150.0
    _http: httpx.Client = field(default=None, repr=False)  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if not API_KEY_PATTERN.match(self.api_key):
            raise ValueError("api_key is not a naa_ key")
        if self.grant_token is not None and not GRANT_TOKEN_PATTERN.match(self.grant_token):
            raise ValueError("grant_token is not an ngt_ token")
        self.base_url = self.base_url.rstrip("/")
        if self._http is None:
            self._http = httpx.Client(follow_redirects=False)

    @classmethod
    def from_env(cls) -> "AgentApi":
        return cls(
            api_key=os.environ["NEAR_INTENTS_AGENT_API_KEY"],
            base_url=os.environ.get("NEAR_INTENTS_AGENT_API_URL", DEFAULT_BASE_URL),
        )

    def for_grant(self, grant_token: str) -> "AgentApi":
        """A client that sends `X-Grant-Token` on delegated calls. One per session/assistant/bot."""
        return AgentApi(self.api_key, self.base_url, grant_token, self.timeout_s, self.settlement_timeout_s, self._http)

    # -- transport ---------------------------------------------------------------------------

    def request(
        self,
        method: str,
        path: str,
        *,
        query: dict[str, Any] | None = None,
        body: Any = None,
        idempotency_key: str | None = None,
        grant: bool = False,
    ) -> Any:
        headers = {"accept": "application/json", "x-api-key": self.api_key}
        if body is not None:
            headers["content-type"] = "application/json"
        if idempotency_key is not None:
            headers["idempotency-key"] = idempotency_key
        if grant:
            if not self.grant_token:
                raise ValueError("this call needs a grant: use api.for_grant(token)")
            headers["x-grant-token"] = self.grant_token
        params = {k: (str(v).lower() if isinstance(v, bool) else v) for k, v in (query or {}).items() if v is not None}
        settlement = path.endswith(SETTLEMENT_PATHS) and not (isinstance(body, dict) and body.get("dry"))
        try:
            response = self._http.request(
                method,
                self.base_url + path,
                params=params,
                headers=headers,
                content=None if body is None else json.dumps(body),
                timeout=self.settlement_timeout_s if settlement else self.timeout_s,
            )
        except httpx.HTTPError as error:
            raise AgentApiRequestError(error, idempotency_key) from error
        document = response.json() if response.content else None
        if response.status_code >= 400:
            raise AgentApiError(response.status_code, document, idempotency_key)
        return document

    # -- owner intents -----------------------------------------------------------------------

    def generate_intent(self, request: dict[str, Any], idempotency_key: str | None = None) -> dict[str, Any]:
        return self.request("POST", "/v1/generate-intent", body=request, idempotency_key=idempotency_key)

    def submit_intent(self, intent_type: str, correlation_id: str, signed_data: dict[str, Any]) -> dict[str, Any]:
        body = {"type": intent_type, "correlation_id": correlation_id, "signed_data": signed_data}
        return self.request("POST", "/v1/submit-intent", body=body)

    def get_status(self, correlation_id: str, wait_ms: int | None = None, refresh: bool | None = None) -> dict[str, Any]:
        query = {"correlation_id": correlation_id, "wait_ms": wait_ms, "refresh": refresh}
        return self.request("GET", "/v1/status", query=query)

    def wait_for_status(self, correlation_id: str, deadline_s: float = 300.0) -> dict[str, Any]:
        """Long-polls until the operation stops moving (anything but PROCESSING/QUEUED).
        UNCERTAIN: keep observing the SAME id later; never resubmit under a new key."""
        end = time.monotonic() + deadline_s
        while True:
            status = self.get_status(correlation_id, wait_ms=30_000)
            if status["status"] not in STILL_MOVING or time.monotonic() > end:
                return status

    # -- reads -------------------------------------------------------------------------------

    def get_network(self) -> dict[str, Any]:
        return self.request("GET", "/v1/network")

    def get_tokens(self) -> list[dict[str, Any]]:
        return self.request("GET", "/v1/tokens")["data"]

    def whoami(self) -> dict[str, Any]:
        return self.request("GET", "/v1/whoami")

    def get_quotas(self) -> dict[str, Any]:
        return self.request("GET", "/v1/quotas")

    def list_agents(self, external_user_id: str | None = None, cursor: str | None = None) -> dict[str, Any]:
        return self.request("GET", "/v1/agents", query={"external_user_id": external_user_id, "cursor": cursor})

    def get_agent(self, agent_id: str) -> dict[str, Any]:
        return self.request("GET", f"/v1/agents/{agent_id}")

    def get_balances(self, agent_id: str, source: str = "public", asset: str | None = None) -> dict[str, Any]:
        return self.request("GET", f"/v1/agents/{agent_id}/balances", query={"source": source, "asset": asset})

    def get_policy(self, agent_id: str) -> dict[str, Any]:
        return self.request("GET", f"/v1/agents/{agent_id}/policy")

    def list_grants(self, agent_id: str) -> list[dict[str, Any]]:
        return self.request("GET", f"/v1/agents/{agent_id}/grants")["data"]

    def get_history(
        self, agent_id: str, limit: int = 25, cursor: str | None = None, include_unpaid: bool | None = None
    ) -> dict[str, Any]:
        query = {"limit": limit, "cursor": cursor, "include_unpaid": include_unpaid}
        return self.request("GET", f"/v1/agents/{agent_id}/history", query=query)

    def list_scheduled(self, agent_id: str, limit: int = 25, cursor: str | None = None) -> dict[str, Any]:
        return self.request("GET", f"/v1/agents/{agent_id}/executions/scheduled", query={"limit": limit, "cursor": cursor})

    def list_approvals(self, agent_id: str) -> list[dict[str, Any]]:
        return self.request("GET", f"/v1/agents/{agent_id}/approvals")["data"]

    def get_containment(self, agent_id: str) -> dict[str, Any]:
        return self.request("GET", f"/v1/agents/{agent_id}/containment")

    # -- executions (grant) ------------------------------------------------------------------

    def quote_swap(self, agent_id: str, request: dict[str, Any]) -> dict[str, Any]:
        """Dry run: no grant, no idempotency key, no budget charge."""
        return self.request("POST", f"/v1/agents/{agent_id}/swap", body={**request, "dry": True})

    def quote_withdraw(self, agent_id: str, request: dict[str, Any]) -> dict[str, Any]:
        return self.request("POST", f"/v1/agents/{agent_id}/withdraw", body={**request, "dry": True})

    def _execute(self, agent_id: str, action: str, request: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        return self.request(
            "POST", f"/v1/agents/{agent_id}/{action}", body=request, idempotency_key=idempotency_key, grant=True
        )

    def swap(self, agent_id: str, request: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        return self._execute(agent_id, "swap", request, idempotency_key)

    def withdraw(self, agent_id: str, request: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        return self._execute(agent_id, "withdraw", request, idempotency_key)

    def transfer(self, agent_id: str, request: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        return self._execute(agent_id, "transfer", request, idempotency_key)

    def shield(self, agent_id: str, request: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        return self._execute(agent_id, "shield", request, idempotency_key)

    def unshield(self, agent_id: str, request: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        return self._execute(agent_id, "unshield", request, idempotency_key)

    def recover(self, agent_id: str, correlation_id: str, original: dict[str, Any], original_key: str) -> dict[str, Any]:
        """Only for UNCERTAIN operations that provably never reached the provider.
        `original` = the original body plus `type`; `original_key` = the original Idempotency-Key."""
        body = {"correlation_id": correlation_id, "request": original}
        return self._execute(agent_id, "recover", body, original_key)

    def deposit(self, agent_id: str, request: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        """Inbound address: API key + Idempotency-Key only, no grant."""
        return self.request("POST", f"/v1/agents/{agent_id}/deposit", body=request, idempotency_key=idempotency_key)


# ------------------------------------------------------------------------------ NEAR signing
# Exact byte formats; verified against near-api-js. Never rebuild or reorder a payload.

_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
NEP413_TAG = 2**31 + 413  # NEP-413 prefix
NEP366_TAG = 2**30 + 366  # NEP-461 prefix for delegate actions


def b58decode(value: str) -> bytes:
    number = 0
    for char in value:
        number = number * 58 + _B58.index(char)
    raw = number.to_bytes((number.bit_length() + 7) // 8, "big")
    return b"\x00" * (len(value) - len(value.lstrip("1"))) + raw


def b58encode(data: bytes) -> str:
    number = int.from_bytes(data, "big")
    out = ""
    while number:
        number, rem = divmod(number, 58)
        out = _B58[rem] + out
    return "1" * (len(data) - len(data.lstrip(b"\x00"))) + out


@dataclass
class NearKey:
    """A NEAR ed25519 key from `ed25519:<base58(seed || public)>` (near-cli / near-api-js format)."""

    secret: str

    def __post_init__(self) -> None:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

        raw = b58decode(self.secret.removeprefix("ed25519:"))
        self._key = Ed25519PrivateKey.from_private_bytes(raw[:32])
        self.public_bytes = self._key.public_key().public_bytes_raw()
        self.public_key = "ed25519:" + b58encode(self.public_bytes)

    def sign(self, message: bytes) -> bytes:
        return self._key.sign(message)


def _borsh_string(value: str) -> bytes:
    data = value.encode("utf-8")
    return struct.pack("<I", len(data)) + data


def _borsh_bytes(data: bytes) -> bytes:
    return struct.pack("<I", len(data)) + data


def _u128(value: int) -> bytes:
    return value.to_bytes(16, "little")


def sign_nep413(key: NearKey, payload: dict[str, str]) -> dict[str, str]:
    """NEP-413 message signature (used for off-chain owner consent: grants, local policy edits,
    approval votes, ...). Returns the extra `signed_data` fields."""
    nonce = base64.b64decode(payload["nonce"])
    assert len(nonce) == 32
    body = (
        struct.pack("<I", NEP413_TAG)
        + _borsh_string(payload["message"])
        + nonce
        + _borsh_string(payload["recipient"])
        + b"\x00"  # callbackUrl: None
    )
    signature = key.sign(hashlib.sha256(body).digest())
    return {"public_key": key.public_key, "signature": base64.b64encode(signature).decode()}


def js_json(value: Any) -> bytes:
    """Byte-identical to JavaScript `JSON.stringify(value)` for API payloads (key order kept)."""
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def encode_delegate_action(
    sender_id: str, payload: dict[str, Any], public_key: bytes, nonce: int, max_block_height: int
) -> bytes:
    """Borsh `DelegateAction` (without the NEP-461 prefix)."""
    actions = b""
    for action in payload["actions"]:
        params = action["params"]
        actions += (
            b"\x02"  # Action::FunctionCall
            + _borsh_string(params["methodName"])
            + _borsh_bytes(js_json(params["args"]))
            + struct.pack("<Q", int(params["gas"]))
            + _u128(int(params["deposit"]))
        )
    return (
        _borsh_string(sender_id)
        + _borsh_string(payload["receiverId"])
        + struct.pack("<I", len(payload["actions"]))
        + actions
        + struct.pack("<Q", nonce)
        + struct.pack("<Q", max_block_height)
        + b"\x00"  # KeyType::ED25519
        + public_key
    )


def sign_delegate(
    key: NearKey, sender_id: str, payload: dict[str, Any], access_key_nonce: int, block_height: int
) -> str:
    """Base64 borsh `SignedDelegate` for an `nep366` payload, given the owner's access-key state."""
    action = encode_delegate_action(sender_id, payload, key.public_bytes, access_key_nonce + 1, block_height + 120)
    signature = key.sign(hashlib.sha256(struct.pack("<I", NEP366_TAG) + action).digest())
    return base64.b64encode(action + b"\x00" + signature).decode()


def sign_nep366(key: NearKey, account_id: str, payload: dict[str, Any], rpc_url: str) -> dict[str, str]:
    """NEP-366 gasless delegate action (on-chain owner changes; the API's sponsor pays gas)."""
    rpc = httpx.post(
        rpc_url,
        json={
            "jsonrpc": "2.0",
            "id": "access-key",
            "method": "query",
            "params": {
                "request_type": "view_access_key",
                "finality": "final",
                "account_id": account_id,
                "public_key": key.public_key,
            },
        },
        timeout=20,
    ).json()
    if "error" in rpc or "error" in rpc.get("result", {}):
        raise RuntimeError(f"view_access_key failed: {rpc}")
    result = rpc["result"]
    signed = sign_delegate(key, account_id, payload, int(result["nonce"]), int(result["block_height"]))
    return {"signed_delegate": signed}


def sign_eip712(private_key: str, payload: dict[str, Any]) -> dict[str, str]:
    """EIP-712 typed data (EVM owners). `payload` already contains `EIP712Domain`."""
    from eth_account import Account
    from eth_account.messages import encode_typed_data

    signed = Account.sign_message(encode_typed_data(full_message=payload), private_key=private_key)
    return {"signature": "0x" + signed.signature.hex().removeprefix("0x")}


def evm_owner(private_key: str, chain_id: int = 1) -> dict[str, Any]:
    """Public `OwnerWallet` for an EVM key: lowercase address + 64-byte uncompressed pubkey (no 04)."""
    from eth_account import Account
    from eth_keys import keys

    account = Account.from_key(private_key)
    public = keys.PrivateKey(bytes.fromhex(private_key.removeprefix("0x"))).public_key.to_hex()
    return {"type": "evm", "address": account.address.lower(), "chain_id": chain_id, "public_key": public}


def near_owner(account_id: str, key: NearKey) -> dict[str, str]:
    return {"type": "near", "account_id": account_id, "public_key": key.public_key}


def sign_intent(
    generated: dict[str, Any],
    *,
    near_key: NearKey | None = None,
    rpc_url: str = "https://free.rpc.fastnear.com",
    evm_private_key: str | None = None,
) -> dict[str, Any]:
    """Turns a `generate-intent` response into `signed_data`, picking the method from
    `intent.standard`. The payload is echoed back unchanged."""
    intent = generated["intent"]
    standard, payload = intent["standard"], intent["payload"]
    if standard == "nep413":
        assert near_key, "nep413 needs the NEAR owner key"
        return {**intent, **sign_nep413(near_key, payload)}
    if standard == "nep366":
        assert near_key, "nep366 needs the NEAR owner key"
        return {**intent, **sign_nep366(near_key, generated["signer"]["account_id"], payload, rpc_url)}
    if standard == "eip712":
        assert evm_private_key, "eip712 needs the EVM owner key"
        return {**intent, **sign_eip712(evm_private_key, payload)}
    raise ValueError(f"{standard} must be signed by the owner's authenticator in the browser")


def run_owner_intent(api: AgentApi, request: dict[str, Any], sign: Any, idempotency_key: str | None = None) -> dict[str, Any]:
    """generate -> sign -> submit -> wait. `sign(generated) -> signed_data`."""
    generated = api.generate_intent(request, idempotency_key or create_idempotency_key())
    api.submit_intent(generated["type"], generated["correlation_id"], sign(generated))
    return api.wait_for_status(generated["correlation_id"])


def iterate_pages(fetch: Any) -> Iterable[dict[str, Any]]:
    """`for agent in iterate_pages(lambda c: api.list_agents(cursor=c))`."""
    cursor = None
    while True:
        page = fetch(cursor)
        yield from page["data"]
        cursor = page.get("next_cursor")
        if not cursor:
            return
