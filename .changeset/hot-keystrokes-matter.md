---
"@everything-dev/proposals-plugin": patch
"api": patch
"ui": patch
---

Fix proposal attribution: store NEAR wallet address as `createdBy` instead of opaque user ID, and fix project ownership when proposals are approved by admins.

- **proposals plugin**: Prefer `walletAddress` for `actorId` so `createdBy` stores the nominator's NEAR account (e.g. `alice.near`), making "Nominated by" display as a linkable identity on the builders page.
- **api**: Use `proposal.createdBy` as fallback for `ownerId` in the projects create callback, so approved projects are attributed to the original proposer instead of the approving admin.
- **ui**: Always include `defaultOwnerId` in project proposal payloads so non-admin proposals carry the proposer's identity even when the ownerId field is hidden from the form.