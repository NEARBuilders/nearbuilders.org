---
"api": minor
"ui": minor
"@everything-dev/proposals-plugin": patch
"@everything-dev/nearcatalog-plugin": patch
---

Add the approved-builder NEAR Catalog contribution proposal flow.

- Keep Catalog proposals private to their submitter and administrators across proposal lists, counts, audit logs, and event streams.
- Add authenticated Catalog claim proposal submission and current-builder status APIs with server-derived claimant identity, active-project validation, normalized roles, idempotent retries, and rejected-only revisions.
- Resolve linked NEAR identity from the auth context so notification reads and streams remain authenticated.
- Accept array-shaped Catalog tags and isolate malformed search entries without converting valid empty results into upstream errors.
- Add URL-backed manual activity and project contribution tabs with Project contribution as the approved-builder default, Catalog project search and preview, multi-role submission, proposal status cards, rejected-proposal editing, and an owner-only builder profile CTA.
