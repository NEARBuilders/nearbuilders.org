# Activity on Private Profile

### Context
This is a child ticket of #23, blocked by #31, to give builders a private page at `/profile/activity` where they can view their own activity feed and manually submit new contributions. Unlike the public profile tab (Ticket 4) which is read-only and visible to everyone, this page is auth-gated and only accessible to the profile owner. The feed mirrors the public tab — showing all of the builder's activity — with a submission form at the top for manually adding work (video, image, doc, URL). Submissions emit into the activity plugin (Ticket 2) with `source: "manual"`, `verified: false`. Follows the `builder-form.tsx` patterns for TanStack Form + shadcn/ui.

### Overview
Create `routes/_layout/_authenticated/profile.activity.tsx` at `/profile/activity`. Display the builder's own activity feed (same cards as Ticket 4, filtered by `actor`), with a TanStack Form at the top for submitting manual activity: title, description, media URL, tags (comma-separated with live badge preview). Emits via the activity plugin's `emitActivity` (Ticket 2). Use TanStack Router's `loader` for prefetching the activity feed.

### Acceptance Criteria
- [ ] `routes/_layout/_authenticated/profile.activity.tsx` — private activity page at `/profile/activity`
- [ ] Gated behind auth (`_authenticated` layout — only logged-in users)
- [ ] Activity feed below the form (reuse card component from Ticket 3 and Ticket 4, filtered by `actor: currentNearAccount`)
- [ ] Empty state ("No activity yet") when builder has no events
- [ ] Loading skeleton while fetching
- [ ] Submission form at the top of the page:
  - Title (required, max 200)
  - Description (optional, max 1000)
  - Media URL (optional, max 500)
  - Tags (comma-separated with live badge preview — reuse `builder-form.tsx` tag pattern)
- [ ] Uses TanStack Form for state management
- [ ] Emits activity event with `source: "manual"`, `type: "upload"`, `verified: false`, `actor: currentNearAccount`
- [ ] Loading state during submit, success/error toasts via sonner
- [ ] On successful submit, the feed refetches to show the new entry
- [ ] Must follow TanStack Router best practices (prefetch in `loader`)
- [ ] Must follow everything-dev and every-plugin best practices
