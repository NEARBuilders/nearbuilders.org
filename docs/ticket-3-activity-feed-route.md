### Context
This is a child ticket of #23, blocked by #31, to create a public `/activity` page with live feed. As reported contributions flow into the activity ledger, the community will want to browse the feed, to discover and endorse them. It will leverage the existing voting plugin (`plugins/votes`), which already handles generic upvote/downvote on any `entityId`, and we reuse it for endorsing activity events. The projects board (`routes/_layout/projects/index.tsx`) demonstrates the filter + vote + SSE pattern to follow.

The `/activity` page also needs to be discoverable from the main navigation. The sidebar in `_layout.tsx` already has Browse entries for Builders, Projects, and Events (with plugins sidebar config in `bos.config.json`). Activity should be added as a browsable category.

### Overview
Create the TanStack Query layer in `ui/src/lib/queries/activity.ts` following the patterns in `ui/src/lib/queries/builders.ts`. Build `routes/_layout/activity.tsx` — a filterable feed page with activity cards. Every card needs vote arrows wired to the votes plugin (activity event ID as `entityId`), endorsement counts batched via `getUpvoteCounts`, and SSE streaming for live feed updates. Use TanStack Router's `loader` for prefetching with `queryClient.prefetchInfiniteQuery`. Also add an "Activity" entry in the left sidebar.

### Acceptance Criteria
- [ ] `ui/src/lib/queries/activity.ts`:
  - `activityFeedQueryOptions({ source, type, actor, limit, cursor })` — paginated feed
  - `emitActivityMutation` — emit a new activity event
  - `leaderboardQueryOptions({ period })` — leaderboard data
  - Proper cache invalidation on mutations
  - `ActivityEvent` type exported
- [ ] `routes/_layout/activity.tsx` — activity feed page
- [ ] Filter bar: source (All/Manual/NearCatalog), type (All/Upload/Claim), sort (Recent / Most Endorsed)
- [ ] Activity cards display:
  - Source badge (distinct colors per source), type badge, verified badge (✓ when `verified: true`)
  - Actor name via NearProfile badge
  - Payload preview: title, description, media thumbnail (if `payload.mediaUrl`)
  - Tags (from `payload.tags`)
  - Endorsement count with up/down vote arrows
  - Timestamp
- [ ] Vote arrows call `apiClient.upvote({ entityId: activityEvent.id })` / `apiClient.downvote({ entityId: activityEvent.id })`
- [ ] Endorsement counts batched via `apiClient.getUpvoteCounts({ entityIds })`
- [ ] SSE subscription for live feed updates (reuse pattern from `subscribeUpvotes` in `api/src/index.ts`)
- [ ] Paginated with "Load more" or infinite scroll
- [ ] Loading skeletons while fetching
- [ ] Empty state when no activity exists ("No activity yet")
- [ ] "Activity" link in `_layout.tsx` sidebar under Browse section, linking to `/activity`
- [ ] Matches existing sidebar entry styling (icon, label, active state via router)
- [ ] Must follow everything-dev and every-plugin best practices
