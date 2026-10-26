---
"api": minor
"ui": minor
"@everything-dev/nearcatalog-plugin": minor
---

Send approved NEAR Catalog listings to NEAR Catalog's API (#290).

- Off until `NEARCATALOG_SUBMIT_URL` and `NEARCATALOG_SUBMIT_TOKEN` are set. Unset, approvals behave exactly as before and nothing is sent or stored as an error.
- Admin approval sends the exact export record with a Bearer token, a stable external id (`project:<id>` / `person:<nearAccount>`) and `source: "nearbuilders"`. On success the listing is marked published and the slug and URL from NEAR Catalog are kept.
- Small edits and re-approved big edits send an update. Rejected, withdrawn, private and deleted records that were sent get a remove.
- Each request times out after 5 seconds and never fails the approval. Failures are stored per listing and shown in the admin NEAR Catalog tab with a Retry button. Retries reuse the external id, so they can't duplicate.
- The token is never logged, returned or sent to the UI. The request shape is a proposal pending NEAR Catalog's confirmation, documented in `plugins/nearcatalog/README.md`.
