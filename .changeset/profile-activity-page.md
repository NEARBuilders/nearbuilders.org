---
"ui": minor
---

Add a private `/profile/activity` page (#34).

- Auth-gated page where a builder views their own activity feed (filtered by their NEAR account) and manually submits contributions.
- Submission form (TanStack Form): title, description, media URL, and comma-separated tags with a live badge preview; emits an activity event with `source: "manual"`, `type: "upload"`, `verified: false`. Success/error toasts, and the feed refetches on submit.
- Extracts the activity feed into a shared `ActivityFeed` component (and a presentational `ActivityCard`) reused by both the public `/activity` page and this private page, so the feed/endorsement/SSE logic lives in one place.
