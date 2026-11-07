# Explore: Partner programs on /build

### Context
Exploration for #327. The question is whether `/build` can list partner programs (credits, grants, bounties, API access, accelerators), what a program is in our data model, who decides what gets listed, and how it relates to the partner-portal link that is already on `/build`. This doc answers each question from the issue and ends with a recommendation and proposed follow-up tickets. It changes no code.

### What exists today
- **`/build` is static content.** `ui/src/routes/_public/build.tsx` renders `buildTopics` and `buildGetInvolved` from `ui/src/lib/build-content.ts`. Nothing on the page comes from the database except the "Get involved" project cards.
- **Featured projects are curated in code.** `buildGetInvolved.featuredProjectSlugs` (`ui/src/lib/build-content.ts`) is a hard-coded list of project slugs. `ui/src/lib/queries/featured-projects.ts` loads them with `listProjects({ slugs, status: "active" })`, drops private or inactive ones (`isFeaturableProject`) and keeps the code order. `ui/src/components/get-involved-card.tsx` renders each one.
- **The partner-portal link is a tool access step, not a program.** The Agent Connect tool has an `access` block (`BuildAccess` in `build-content.ts`) with "Get an API key from the partner portal" pointing at `partners.demo.agentsonintents.com` and a base URL to copy. NEAR AI Cloud has the same block pointing at `cloud.near.ai`. `ToolSection` in `build.tsx` renders it as a two-step "Get access" card.
- **We already run one program ourselves.** `plugins/credits` lets approved builders claim NEAR AI Cloud credits. It has open/close dates and key expiry (`creditSettings.claimsCloseAt` and `keyExpiresAt` in `plugins/credits/src/db/schema.ts`), an admin tab (`ui/src/routes/_admin/admin/dashboard/credits.tsx`), and a claim card on the dashboard (`ui/src/components/credit-claim-card.tsx`). It is the closest thing to a partner program we have, but `/build` doesn't mention it.
- **Projects carry no program fields.** The `projects` table (`plugins/projects/src/db/schema.ts`) has `kind`, `status`, `visibility`, `domain`, `logoUrl`, `organizationId` and a `catalog` jsonb (`projectCatalogSchema` in `plugins/projects/src/contract.ts`: tagline, categories, phase, links, token contract, CoinGecko id). There is no featured flag and no tags beyond catalog categories.
- **Review already exists.** New projects can go through the proposals plugin (`plugins/proposals/src/db/schema.ts`, `reviewStatus` pending/approved/rejected), switched on by `REQUIRE_ADMIN_APPROVAL` (`api/src/index.ts`).

### Questions from the issue

**1. Data model: registered projects or a new entity?**
Both: a program belongs to a registered project, but it is its own row. A project can run more than one program (NEAR AI already has credits and could add a grant), and each program has its own dates and status. Putting programs inside the project's `catalog` jsonb would make dates, status and ordering hard to query and would mix owner-editable data with admin-curated data.

Proposed table `project_programs` in the projects plugin:

| Field | Notes |
|---|---|
| `id`, `projectId` | `projectId` references `projects.id`; the card takes its logo, title and link from the project |
| `type` | `credits` \| `grant` \| `bounty` \| `api-access` \| `accelerator` \| `hackathon` |
| `title`, `summary` | Short, shown on the card |
| `rewards` | Free text, e.g. "$500 in NEAR AI Cloud credits". No amounts as numbers in v1 |
| `eligibility` | Free text, e.g. "Approved NEAR Builders" |
| `ctaLabel`, `ctaUrl` | External https URL, or an internal path such as `/dashboard` for our own credits |
| `topicId` | Optional `BuildTopicId` (`smart-contracts`, `private-cloud`, `agentic-commerce`) so a program can also show next to its topic |
| `opensAt`, `closesAt` | Optional. `closesAt` empty means rolling |
| `status` | `draft` \| `listed` \| `paused` \| `archived` |
| `sortOrder` | Admin-set integer for promotion |
| `createdBy`, `createdAt`, `updatedAt` | Audit |

Open or closed is derived, not stored: a `listed` program is open when now is between `opensAt` and `closesAt`, and closed after `closesAt`.

**2. Curation: who qualifies and who approves?**
Admin-curated. Programs make claims about money and eligibility, so a person should check each one before it appears on `/build`.
- A project qualifies if it is `kind = "project"`, `status = "active"`, not private, and approved (the same checks `isFeaturableProject` and the Activity registration gate in `api/src/index.ts` already use).
- v1: admins create and edit programs in a new admin tab. No owner form.
- Later: project owners can submit a program as a proposal (`pluginId: "projects"`, a new operation), reviewed in the existing admin proposals queue. This reuses review, audit log and rejection reasons we already have.
- Automatic inclusion by criteria (for example "every project tagged `grants`") is not recommended. Catalog categories are self-reported, and a wrong reward line on our page reads as our promise.

**3. Presentation on /build**
- A new "Partner programs" section between the topic tool sections and "Get involved". The page reads as: what to build with, who will help fund or support it, how to take part.
- Card: project logo and name (reuse `ProjectVisual` as `GetInvolvedCard` does), a type chip, program title, the `rewards` line, the `eligibility` line, and a date line ("Closes 30 Nov" or "Rolling"). One primary CTA from `ctaLabel` / `ctaUrl` (external link icon for https, arrow for internal), plus "View project".
- If a program has a `topicId`, also show a one-line link to it inside that topic's `ToolSection`, so Private Cloud points at the credits program.
- Only open programs show. If none are open, hide the section rather than show an empty state.
- Our own NEAR AI credits are the first card: type `credits`, CTA "Claim credits" to `/dashboard`, dates from `creditSettings`.

**4. Lifecycle**
- `draft` → `listed` → `archived`, with `paused` to hide a listed program without losing it. Admins move programs between states.
- Closing is automatic: past `closesAt`, the program drops off `/build` and shows as "Closed" on its project page. No cron is needed because status is derived when the list is read.
- Promotion and demotion is `sortOrder`. Programs closing within 7 days could sort first, but that can wait.
- If the parent project is archived, made private or deleted, its programs stop listing (filter on the join).

**5. Relationship to the partner-portal link**
Separate concepts, kept separate.
- The `access` block on Agent Connect and NEAR AI Cloud is "how to get a key to use this tool". It is part of the tool's docs and is always there.
- A partner program is a time-bound offer from a project with eligibility and a reward.
- They can point at each other: a program with `topicId: "agentic-commerce"` can say "Apply for partner access" and link to the same portal. The access block stays in `build-content.ts`, and the program card adds dates and terms.

### Recommendation
Model partner programs as a `project_programs` table owned by the projects plugin, one row per program linked to a registered project, curated by admins only in v1. Ship it in two steps:
1. **v0, code-curated:** add `buildPrograms` to `ui/src/lib/build-content.ts`, a typed list keyed by project slug, using the same shape as the table. This matches how `featuredProjectSlugs` works today, needs no migration, and lets us list NEAR AI credits on `/build` right away.
2. **v1, data-backed:** move the list to `project_programs` with a public `listPrograms` endpoint and an admin tab. Owner-submitted programs through proposals come after that, only if partners ask for it.

### Proposed follow-up tickets
1. **Partner programs section on /build (code-curated).** Add a `BuildProgram` type and `buildPrograms` list to `build-content.ts`, a `ProgramCard` component, and the section in `build.tsx`. First entry: NEAR AI Cloud credits linking to `/dashboard`. Hide closed programs by date. Unit tests for the open/closed filter.
2. **`project_programs` table and public list endpoint.** Drizzle schema and migration in `plugins/projects`, `listPrograms` (public, open and listed only, joined to active non-private projects) and `getProjectPrograms` for a project page. Contract tests.
3. **Admin tab for programs.** `ui/src/routes/_admin/admin/dashboard/programs.tsx`: create, edit, pause, archive and reorder programs for a chosen project. Admin-only procedures.
4. **Switch /build to the API.** Replace `buildPrograms` with `listPrograms`, keep the same card. Show a program's link inside its topic's tool section when `topicId` is set.
5. **Programs on the project page.** A "Programs" block on `/projects/$kind/$slug` listing a project's open and recently closed programs.
6. **Owner-submitted programs (later).** Let a project owner propose a program through the proposals plugin, reviewed in the existing admin queue. Only if partners ask for it.
