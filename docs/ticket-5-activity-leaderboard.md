### Context
This is a child ticket of #23, blocked by #31, to surface the leaderboard from the activity plugin's (Ticket 2) `getLeaderboard` endpoint. That endpoint already computes ranked scores server-side (event count × endorsement weight). Evaluators need this surfaced as a page — a ranked view of who is actively contributing, filterable by time period.

### Overview
Create `routes/_layout/activity/leaderboard.tsx`. Query the `getLeaderboard` API from the activity plugin (Ticket 2). Display ranked cards with builder NearProfile badges, activity counts, endorsement scores, and source breakdown. Add a time period filter (week/month/all-time). Use TanStack Router's `loader` for prefetching.

### Acceptance Criteria
- [ ] `routes/_layout/activity/leaderboard.tsx` — leaderboard page
- [ ] Queries `apiClient.getLeaderboard({ period })` from activity plugin
- [ ] Ranking cards display:
  - Rank number (1, 2, 3...)
  - Builder avatar/name via NearProfile badge (links to `/builders/$account`)
  - Total activity event count
  - Endorsement score (aggregate upvote count across all activity events)
  - Top sources breakdown (e.g. "3 claims, 5 uploads")
- [ ] Time period filter: week, month, all-time (passed to API)
- [ ] Paginated (top 50 per page)
- [ ] Loading skeleton, empty state ("No activity recorded")
- [ ] Must follow everything-dev and every-plugin best practices
