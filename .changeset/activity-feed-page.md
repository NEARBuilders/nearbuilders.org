---
"ui": minor
---

Add a public `/activity` page with a live feed (#23).

- **Activity feed**: New browse page at `/activity` rendering activity-ledger events as cards — source/type/verified badges, actor via the NEAR profile badge, payload preview (title, description, media thumbnail, tags), and a relative timestamp. Filter by source (All/Manual/NearCatalog) and type (All/Upload/Claim), and sort by Recent or Most Endorsed.
- **Endorsements**: Up/down vote arrows on each card endorse events through the existing votes plugin (the activity event id is the vote `entityId`), with endorsement counts batched via `getUpvoteCounts` and optimistic updates.
- **Live updates**: SSE subscriptions stream new activity events (prepended to the feed) and endorsement-count changes in real time.
- **Navigation**: "Activity" added to the main nav (desktop + mobile) alongside Builders/Projects/Events.
- **Query layer**: New `ui/src/lib/queries/activity.ts` with `activityFeedQueryOptions` (infinite), `leaderboardQueryOptions`, `emitActivityMutationOptions` (with cache invalidation), and an `ActivityEvent` type.
