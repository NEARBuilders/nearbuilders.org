# Explore: Feedback and Activity as next steps for your project

### Context
Exploration for #326. After a builder creates a project on nearbuilders.org, we want to point them to the two companion apps, feedback.nearbuilders.org and activity.nearbuilders.org. We also want to show whether the project is already set up on each one, without the builder leaving nearbuilders.org. This doc answers each question from the issue and ends with a recommendation and proposed follow-up tickets. It changes no code.

Related: NEARBuilders/activity.nearbuilders.org#97 (MCP registration flow), NEARBuilders/feedback.nearbuilders.org#222 and its fix PR NEARBuilders/feedback.nearbuilders.org#225 (the `manage/new` deep link).

### What exists today

**On nearbuilders.org**
- **Creating a project lands on its page.** `onSuccess` in `ui/src/routes/_public/projects/new.$kind.tsx` shows a toast and navigates to `/projects/$kind/$slug`. There is no separate success screen.
- **Activity status is already wired end to end.**
  - `plugins/activity/src/services/activity-registration.ts` calls activity's `GET /api/v1/projects/{projectId}/activity` from the server, with a 30-second cache.
  - It is exposed as `getProjectActivity` (`GET /projects/{projectId}/activity` in `api/src/contract.ts`, public).
  - It returns `status: none | connected | tracked | rejected`, plus `sourceId`, `displayName`, `reviewReason` and `activityUrl`.
- **Activity actions are owner-only.** `ui/src/components/project-activity.tsx` has three pieces:
  - `ProjectActivityAction` shows "Register Activity" when the status is `none`, and "View activity" (linking to `/activity?source=<sourceId>`) when it is `connected` or `tracked`.
  - `ProjectActivityRejected` shows the reviewer's reason when the status is `rejected`.
  - `ProjectActivityBadge` shows "Activity Tracked".
  - The project page (`ui/src/routes/_public/projects/$kind.$slug.tsx`) and the dashboard project rows (`ui/src/routes/_authenticated/_dashboard/dashboard.tsx`) both use them.
- **Registering Activity starts on our side.** `RegisterActivityDialog` collects event names and points.
  - It calls `registerProjectActivity` (`api/src/index.ts`). That checks the caller is the owner and the project is an active, approved, non-unlisted `project`.
  - It then starts a partner binding session on activity with our trusted key and opens the returned `/binding?sessionToken=…` URL.
  - If the project isn't eligible yet, the button is hidden and nothing explains why.
- **Feedback is a static link only.** `feedbackRequestUrl` (`ui/src/routes/_public/projects/-feedback-request.ts`) builds `https://feedback.nearbuilders.org/manage/new?project=<slug>`. The project page shows it as "Request feedback" to every visitor. nearbuilders.org never asks feedback about the project.

**On feedback.nearbuilders.org** (paths in that repo)
- **Projects are keyed by slug.** The `projects` table (`api/src/db/schema.ts`) has a unique `slug` and a nullable `nearbuildersProjectId`. The id comes from the client and is not checked on the server, and no route looks a project up by it.
- **Rounds belong to a project.** The `rounds` table has a status of `pending | open | closed | rejected`.
- **A public lookup already exists.** `getProjectBySlug` (`GET /api/projects/{slug}/detail`, no auth) returns the project with its rounds (`id`, `title`, `status`, `projectRoundNumber`, `endsAt`).
  - It returns NOT_FOUND if the slug is unknown or the project isn't approved.
  - Anonymous callers only see open and closed rounds.
  - Feedback counts are only available per round (`getRoundBySlug`).
- **The deep link 404s on main for new projects.** `ui/src/routes/_authenticated/_dashboard/manage/new.tsx` requires sign-in and loads the slug with `orNotFound`, so a project with no rounds yet hits "Page not found". PR #225 makes unknown slugs fall back to the request form with the slug prefilled. It is still open.
- **Feedback already reads our projects.** It calls `/v1/projects/by-slug/{slug}` (`api/src/services/projects-client.ts`, base `PROJECTS_API_BASE_URL`).

**On activity.nearbuilders.org** (paths in that repo, main at 0dec340)
- **Sources are linked to our project id.** The `activity_sources` table (`api/src/db/schema.ts`) has a unique `nearbuildersProjectId`, which is our project id, not the slug.
- **The status endpoint is public.** `GET /api/v1/projects/{projectId}/activity` is the one our plugin calls. It has no event count or last-event time. `GET /api/v1/events?source=` is public and paginated, and gives the latest event.
- **#97 (MCP) has not started.** The issue is open with nothing checked. No PR, branch or code mentions MCP.
  - What exists today is agent binding sessions without a key (30-minute, rate-limited), the agent skill at `/skill` (`ui/public/skill.md`), and an agent prompt on the `/binding` done screen (PR #69).

### Questions from the issue

**1. Where does the "next steps" surface live?**
On the project page, as an owner-only "Next steps" panel. Creation already lands there, so it doubles as the post-creation success state.
- **Panel:** two rows, Feedback and Activity, each with its status and one CTA. It sits above the description, next to the existing `ProjectReviewStatus` and `ProjectActivityRejected` blocks.
- **Just created:** `new.$kind.tsx` adds `?created=1` when it navigates, so the panel can open expanded with a "Your project is live. Next:" line. No new route is needed.
- **Dashboard:** each project row gets a small Feedback badge next to the existing `ProjectActivityBadge`, so status is visible across all projects.
- **Collapsing:** once both rows are in a "done" state, the panel collapses to the two badges.
- **Visitors** keep seeing only public signals (the Activity Tracked badge, and later an "Open feedback round" link). The CTAs are for owners and collaborators.

**2. How do we check registration status from here?**
A server-side lookup, cached, through our own API. This is how Activity already works.
- **Activity:** keep `getProjectActivity` as is. It is keyed by our project id, which activity stores as a unique column, so it is exact.
- **Feedback:** add the same thing for feedback.
  - A small client calls feedback's public `GET /api/projects/{slug}/detail` from our API, caches the result for 30 to 60 seconds, and exposes `getProjectFeedback` (`GET /projects/{projectId}/feedback`).
  - It returns `status: none | registered | open`, the latest open round (number, title, `endsAt`) and `feedbackUrl`.
  - NOT_FOUND maps to `none`. Network errors map to `unknown`, and the panel shows the plain link.
  - Slugs can't be changed after creation (`updateProject` in `plugins/projects/src/contract.ts` has no `slug` field), so a slug lookup is stable.
- **Why not the alternatives:**
  - *Deep-link lookup only* can't tell us status.
  - *Calling feedback or activity from the browser* adds CORS config on two apps and spreads base URLs across the UI. The server call already has config, timeouts and caching.
  - *Cross-app session sharing* via the everything.dev shared auth and orgs direction is for acting as the user, not for reading public status. We don't need it here. It becomes relevant only if we later want to show private data such as pending rounds or test events.
- **One gap on feedback's side:** projects whose review is pending return NOT_FOUND to anonymous callers, so we would show `none` while a request is waiting.
  - Fix on feedback: a public `GET /projects/{slug}/status` that returns `{ status: pending | approved | rejected, openRounds }`, ideally also by `nearbuildersProjectId` once feedback checks that id on the server.
  - Until then, `none` with a "Request feedback" CTA is acceptable.

**3. What does activity registration look like (the #97 side)?**
Our side doesn't need to wait for MCP.
- **Today:** the owner registers through `RegisterActivityDialog`. Activity confirms through a page-delivery binding session, and our status read flips to `connected`, then `tracked` after the first published event.
- **When #97 lands:** add a second tab to the dialog, "Use your agent", with the copyable prompt from activity. The prompt holds the MCP URL, an API-key placeholder and the project id or slug, so the agent registers against the right project. Status still comes from `getProjectActivity`, so nothing else changes on our side.
- **Until #97 lands:** the tab can link to activity's `/skill` and say "paste this into your agent".
- **States the panel should show:**
  - `none` with an eligible project: "Register Activity".
  - `none` with an ineligible project: "Available once your project is approved". Today the button just disappears.
  - `connected`: "Connected, waiting for the first event", with a link to activity's integration guide.
  - `tracked`: "View activity".
  - `rejected`: the reason, plus a link to fix it on activity.

**4. Feedback: can we detect or request rounds inline?**
- **Detect:** yes, with the lookup above. Show "Round N open until <date>" with "View round" (`/projects/<slug>/<n>` on feedback) when a round is open, and "N past rounds" with "Start a new round" when only closed ones exist.
- **Request inline:** no, not yet. Creating a round needs a signed-in feedback session and the round form on feedback (`manage/new`). Embedding that here would mean cross-app auth or duplicating the form. Keep it as a deep link, and make sure #225 lands first so new projects don't hit a 404. Revisit inline requests once shared auth across the apps is in place.
- **Fix the link's audience:** today every visitor sees "Request feedback". It should be owner and collaborator only. Visitors should get "Give feedback" only when a round is open.

**5. Empty and registered states, with CTAs**

| Row | State | Owner sees | CTA |
|---|---|---|---|
| Feedback | `none` | "Get feedback from other builders" | Request feedback → `manage/new?project=<slug>` |
| Feedback | `registered`, no open round | "N past rounds" | Start a new round → `manage/new?project=<slug>` |
| Feedback | `open` | "Round N open until <date>" | View round → `/projects/<slug>/<n>` |
| Feedback | `unknown` (lookup failed) | "Get feedback from other builders" | Request feedback (same link) |
| Activity | `none`, not eligible | "Available once your project is approved" | none |
| Activity | `none`, eligible | "Reward people who use your app" | Register Activity (dialog) |
| Activity | `connected` | "Connected, waiting for the first event" | Integration guide |
| Activity | `tracked` | "Activity tracked" | View activity → `/activity?source=<id>` |
| Activity | `rejected` | Reviewer's reason | Fix on Activity |

### Recommendation
Put an owner-only "Next steps" panel on the project page, opened expanded right after creation with `?created=1`. Get status from server-side lookups through our own API: keep the existing `getProjectActivity` and add a matching `getProjectFeedback` that reads feedback's public `getProjectBySlug`. Keep feedback requests as a deep link, which depends on feedback PR #225 merging. Add the MCP prompt as a tab in the existing Register Activity dialog once activity#97 ships. Don't use cross-app sessions for this.

### Proposed follow-up tickets
1. **Feedback status lookup.** Add a feedback client (`plugins/feedback` or a service in `api/src/services`) that calls feedback's `GET /api/projects/{slug}/detail` with a timeout and 30-60 second cache. Expose `getProjectFeedback` (`GET /projects/{projectId}/feedback`, public) returning `status`, the latest open round and `feedbackUrl`. Tests for none, registered, open and unreachable.
2. **"Next steps" panel on the project page.** An owner and collaborator panel with Feedback and Activity rows, using the states table above. Opens expanded when `?created=1` is set by `new.$kind.tsx`, and collapses to badges once both rows are done.
3. **Explain Activity eligibility.** Show "Available once your project is approved" (or the matching reason) instead of hiding Register Activity. Show a distinct `connected` state, "waiting for the first event".
4. **Feedback badge on dashboard rows.** Next to `ProjectActivityBadge` in `dashboard.tsx`, using `getProjectFeedback`.
5. **Limit "Request feedback" to owners.** Show "Request feedback" to owners and collaborators only. Visitors see "Give feedback" when a round is open.
6. **"Use your agent" tab in Register Activity.** Blocked on activity.nearbuilders.org#97. Show the copyable prompt (MCP URL, key placeholder, project id) in `RegisterActivityDialog`. Until #97 ships, link to activity's `/skill`.
7. **Feedback: public project status route (feedback repo).** `GET /projects/{slug}/status` returning review status and open-round count, so pending requests show as pending instead of `none`, and optionally a lookup by `nearbuildersProjectId` once feedback checks that id on the server. To be filed on feedback.nearbuilders.org.
