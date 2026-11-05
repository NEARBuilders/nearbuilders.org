# Grants

A grant is the owner's signed permission for **one actor** (a chat session, an assistant, a bot,
a device) to run money actions on the account. It says *who*; the policy says *what*. All grants
of an account share the same policy, limits and USD budget.

## Token and commitment

Your backend creates the token; the API only ever sees its hash.

```text
token      = "ngt_" + base64url_no_padding(32 cryptographically random bytes)   # 47 chars
credential = lowercase_hex(sha256(utf8(token)))                                  # hash the STRING, prefix included
```

| Language | Code |
|---|---|
| TypeScript | `const { token, commitment } = createGrantCredential()` (SDK) |
| Python | `"ngt_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()`; `hashlib.sha256(token.encode()).hexdigest()` |
| Rust | `create_grant_credential()` → `(token, commitment)` in the asset crate |
| Go | `"ngt_" + base64.RawURLEncoding.EncodeToString(b)`; `hex.EncodeToString(sha256.Sum256([]byte(token)))` |

Use a **new token for every grant** (`grant_credential_reused` otherwise). Check your
implementation with `grant.token` / `grant.commitment` in `assets/test-vectors.json`.

## Issue

```json
POST /v1/generate-intent
{ "type": "grant_issue", "agent_id": "…", "label": "telegram-bot",
  "credential": "<sha256 hex>", "expires_at": "2027-04-01T00:00:00Z" }
```

- `label`: what the owner sees in lists and previews; name the actor ("Claude Desktop on
  Alice's laptop", "support-bot prod").
- `expires_at`: required, at most 365 days ahead. Prefer short lives for sessions (hours/days)
  and renew.
- Owner signs → submit → `SUCCESS` → `details.grant.grant_id`.
- Limit: 50 live (unrevoked, unexpired) grants per agent → `grant_limit_reached`.

**Store the token before you ask the owner to sign**, encrypted (KMS envelope or app-level
AES-GCM), keyed by `grant_id` once known. If you lose it, the grant is useless: revoke it and
issue another. Never log it, never put it in an LLM prompt, URL or client bundle.

## Use

Send it as `X-Grant-Token` on swap, withdraw, transfer, shield, unshield, recover (and
sign). One client per grant, so concurrent sessions never borrow each other's token:

```ts
const agentClient = api.forGrant(token);            // TS SDK
```
```python
agent_client = api.for_grant(token)                  # Python asset
```

Every execution's `StatusResponse.grant` = `{ id, label }` shows which grant acted; use it in
activity feeds and audits.

## Revoke

```json
{ "type": "grant_revoke", "agent_id": "…", "grant_id": "<64 hex>" }
```

Takes effect for anything not yet dispatched. Operations already past the dispatch commit finish;
`details.committed_correlation_ids` lists them (`committed_truncated` if the list was cut).
Expired grants stop working by themselves.

Audit: `GET /v1/agents/{id}/grants` (revoked included, each with the canonical `owner_message`
the owner signed) and `GET /v1/agents/{id}/containment` (live grants + unfinished operations).

## Patterns

| Situation | Do |
|---|---|
| Per chat/assistant session | one grant per session, label with the session, expire in hours/days |
| Long-running bot | one grant per bot deployment, rotate (issue new, then revoke old) every N months |
| Third-party integration (MCP client, partner tool) | its own grant so it can be cut off alone |
| User says "stop that assistant" | `grant_revoke` that one grant |
| User says "stop everything" | `agent_freeze` |
| Agent needs a new capability | `policy_update`; do **not** issue a new grant (grants carry no permissions) |

Errors: `agent_grant_required` (403: missing, unknown, revoked, expired or other agent's token),
`grant_limit_reached`, `grant_credential_reused`, `grant_not_found`.
