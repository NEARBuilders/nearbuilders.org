---
"api": patch
---

Reject implicit accounts in builder nominations (#8).

- **api**: The `propose` route now validates the target account when nominating a builder. The entity ID must be a valid NEAR account ID (via `near-kit`'s `AccountIdSchema`), and implicit accounts (64-char hex, `0x`/`0s` EVM-style addresses) are rejected with a `BAD_REQUEST` error, since builder nominations require a named NEAR account.
