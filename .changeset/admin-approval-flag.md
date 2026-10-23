---
"api": minor
"ui": minor
"@everything-dev/projects-plugin": minor
---

Add the `REQUIRE_ADMIN_APPROVAL` flag. It controls admin approval of builder profiles and projects, and it is off by default.

- Flag off: a builder profile submitted from `/join` is approved right away by the system actor `Auto-approved (admin approval off)`. Approval runs through the normal pipeline, so the audit log, builder record, activity and notification match an admin approval. Projects, ideas and scopes can be created or edited as public with no proposal.
- Flag on (`true`, `1`, `yes` or `on`): the current review flow is unchanged.
- Proposals that are already pending stay in the admin queue. Profiles an admin rejected or removed earlier still need admin review when submitted again, and members cannot make a project public once an admin has rejected or removed it. Third-party nominations stay pending. If auto-approval fails, the proposal is left for an admin.
- Adds `GET /approval/settings`. The join and project pages use it to choose between review and publish copy and to decide when to send a proposal.
