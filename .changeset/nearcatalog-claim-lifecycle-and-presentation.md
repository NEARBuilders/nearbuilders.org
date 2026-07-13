---
"@everything-dev/activity-plugin": minor
"@everything-dev/nearcatalog-plugin": minor
"@everything-dev/proposals-plugin": patch
"api": minor
"ui": minor
---

Complete the reviewed NEAR Catalog claim lifecycle and public presentation for issues #54 and #55.

- Derive manual activity identity from authentication, add trusted admin-only activity emission, make emitted events idempotent, and support hiding revoked activity from feeds and leaderboards.
- Apply approved Catalog claims through a compensating workflow that verifies current builder and Catalog state, records a verified activity snapshot, and safely retries or rolls back partial failures.
- Support rejected and removed claim resubmissions while preserving proposal history, and expose complete claim review, retry, rejection, and revocation controls to administrators.
- Present claimed Catalog contributions on builder profiles, render specialized claim activity, and merge current Catalog projects into the public and personal project directories without duplicating local projects.
