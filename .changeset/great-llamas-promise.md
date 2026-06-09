---
"api": minor
"ui": minor
"@everything-dev/projects-plugin": patch
---

Fix project creation attribution and rework the project proposal flow (#7).

- **api**: Add a `createProject` route so projects are always created directly, owned by the logged-in user's NEAR account. Non-admins cannot create public projects directly (public visibility is clamped to private) and must have a linked NEAR account. The proposal approve callback now updates the existing project's visibility instead of recreating it, so the approving admin is never recorded as the creator; proposals for projects that don't exist yet (e.g. API-key sources) are still created and attributed to the original proposer.
- **projects plugin**: Non-admins can no longer flip a project to public via `updateProject`; making a project public requires admin approval through a proposal.
- **ui**: Creating a project now creates it immediately (private first) and, when public visibility is requested, submits a proposal to make it public. The edit page routes public-visibility changes through the same proposal flow. Owner attribution no longer falls back to the opaque auth user id.
