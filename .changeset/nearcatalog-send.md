---
"api": minor
"ui": minor
"@everything-dev/nearcatalog-plugin": minor
---

Send approved projects to NEAR Catalog's partner-submit API (#290).

- Off until `NEARCATALOG_PARTNER_KEY` is set. Unset, approvals behave exactly as before and nothing is sent or stored as an error. `NEARCATALOG_SUBMIT_URL` defaults to NEAR Catalog's partner endpoint, and `NEARCATALOG_CONTACT` sets the curator contact.
- Admin approval posts the project, mapped to NEAR Catalog's fields, with a Bearer key and a stable `uid` (`project:<id>`). It goes to NEAR Catalog's curators for review. People aren't sent, since the partner API takes projects only.
- Small edits and re-approved big edits submit an update with the same `uid`. NEAR Catalog has no partner remove route, so a sent project that is rejected, withdrawn, made private or deleted is flagged in the admin tab to ask their team to hide it.
- Each request times out after 5 seconds and never fails the approval. Failures are stored per listing and shown in the admin NEAR Catalog tab with a Retry button.
- The key is never logged, returned or sent to the UI.
