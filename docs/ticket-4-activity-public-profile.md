# Activity on Public Profile

### Context
This is a child ticket of #23, blocked by #31, to add an Activity tab on builder profiles. Each builder's public profile at `/builders/$account.tsx` already shows a "Projects" tab highlighting their submitted work. Adding an "Activity" tab gives evaluators a complete view of that builder's contributions — uploaded work, claimed catalog projects, and future automated events from NEARN/GitHub. Manual submissions will be handled separately on the private `/profile/activity` page.

### Overview
Add a read-only "Activity" tab to the builder profile page. Show the builder's personal activity feed filtered by actor, reusing the activity card component from the feed route (Ticket 3). Empty state and loading skeleton.

### Acceptance Criteria
- [ ] "Activity" tab on `/builders/$account` route alongside "Projects" tab, with count badge (e.g. `Activity (3)`)
- [ ] Activity cards (reuse card component from Ticket 3) filtered by `actor: $account`
- [ ] Empty state ("No activity yet") when builder has no events
- [ ] Loading skeleton while fetching
- [ ] Must follow everything-dev and every-plugin best practices
