---
"@everything-dev/projects-plugin": patch
"@everything-dev/events-plugin": patch
"api": patch
"ui": patch
---

Fix PR review issues from #27: slug API paths, kind validation, filter preservation, and event error handling.

- **api**: Change slug lookup paths from `/v1/{resource}/slug/{slug}` to `/v1/{resource}/by-slug/{slug}` for both projects and events.
- **events plugin**: Remove redundant SELECT-before-INSERT duplicate slug check (DB unique constraint + catch handler suffice).
- **projects plugin**: Re-add `isProjectKind` validation in `beforeLoad` on project detail and edit routes to redirect invalid kinds to `/projects`.
- **projects plugin**: Restore `kind` search param in navigation links so the kind filter is preserved when moving between list, detail, and edit views.
- **ui**: Change `reviewFailed` toast on event creation to include actionable guidance ("Edit to resubmit.").
- **fix**: Correct `vitest` catalog reference from `"^catalog:"` to `"catalog:"`.
