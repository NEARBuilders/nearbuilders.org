import "dotenv/config";
import { count, inArray } from "drizzle-orm";
import { createDatabaseDriver as createProjectsDatabaseDriver } from "../plugins/projects/src/db/index";
import { projectApps, projectMentions, projects } from "../plugins/projects/src/db/schema";
import { createDatabaseDriver as createVotesDatabaseDriver } from "../plugins/votes/src/db/index";
import { upvotes } from "../plugins/votes/src/db/schema";

type ProjectKind = "project" | "idea" | "scope" | "result";
type ProjectStatus = "active" | "paused" | "archived";
type ProjectVisibility = "private" | "unlisted" | "public";

type ProjectRow = {
  id: string;
  ownerId: string;
  organizationId: string | null;
  kind: ProjectKind;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  repository: string | null;
  domain: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EntrySpec = {
  kind: ProjectKind;
  slug: string;
  title: string;
  ownerId: string;
  organizationId?: string | null;
  description?: string | null;
  content?: string | null;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  repository?: string | null;
  domain?: string | null;
  age: number;
  updatedAge?: number;
};

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const now = Date.now();

function daysAgo(days: number): Date {
  return new Date(now - days * dayInMilliseconds);
}

function seedProjectId(slug: string): string {
  return `seed-project-${slug}`;
}

function defaultContent(kind: ProjectKind, title: string): string {
  const heading = kind.charAt(0).toUpperCase() + kind.slice(1);
  return `## ${heading}\n\n${title} is seeded demo content for testing the directory detail view, metadata rhythm, and markdown rendering.`;
}

const entrySpecs: EntrySpec[] = [
  {
    kind: "project",
    slug: "near-builders-starter-kit",
    title: "NEAR Builders Starter Kit",
    ownerId: "buildguild.near",
    organizationId: "org-buildguild",
    description: "A practical launchpad for shipping a polished NEAR project.",
    content:
      "## Overview\n\nA production-minded starter kit for teams moving from an idea to a public beta. It borrows patterns from @data-labs.near/near-data-lab.\n\n## Current focus\n\n- Wallet connection\n- Project directory\n- Accessible component primitives",
    domain: "starter.nearbuilders.org",
    age: 2,
    updatedAge: 1,
  },
  {
    kind: "project",
    slug: "community-grants-dashboard",
    title: "Community Grants Dashboard",
    ownerId: "open-web.near",
    organizationId: "org-open-web",
    description: "A transparent view of grant rounds, decisions, and delivery milestones.",
    content:
      "## Overview\n\nA dashboard concept for making community-funded work easier to follow.",
    domain: "grants.nearbuilders.org",
    age: 8,
    updatedAge: 3,
  },
  {
    kind: "project",
    slug: "near-data-lab",
    title: "NEAR Data Lab",
    ownerId: "data-labs.near",
    description: "Reusable datasets and experiments for understanding the ecosystem.",
    content: null,
    domain: "data.nearbuilders.org",
    age: 14,
    updatedAge: 5,
  },
  {
    kind: "project",
    slug: "local-first-collective",
    title: "Local-First Collective",
    ownerId: "field-notes.near",
    organizationId: "org-field-notes",
    description: "Offline-friendly collaboration tools for distributed builder teams.",
    content: "## Overview\n\nA paused prototype exploring conflict-free notes and sync handoffs.",
    status: "paused",
    visibility: "unlisted",
    domain: null,
    age: 25,
    updatedAge: 12,
  },
  {
    kind: "project",
    slug: "dao-ops-console",
    title: "DAO Operations Console",
    ownerId: "kernel-house.near",
    organizationId: "org-kernel-house",
    description: "A calmer workspace for proposals, tasks, and operational ownership.",
    content: "## Overview\n\nA console for the small actions that keep a DAO moving.",
    domain: "ops.kernel-house.org",
    age: 31,
    updatedAge: 10,
  },
  {
    kind: "project",
    slug: "open-source-design-system",
    title: "Open Source Design System",
    ownerId: "designguild.near",
    organizationId: "org-designguild",
    description: "Shared interface foundations for NEAR community products.",
    content: "## Overview\n\nTokens, components, and interaction guidance for related products.",
    domain: "design.nearbuilders.org",
    age: 42,
    updatedAge: 4,
  },
  {
    kind: "project",
    slug: "public-goods-index",
    title: "Public Goods Index",
    ownerId: "good-work.near",
    organizationId: "org-good-work",
    description: "A searchable index of open infrastructure and community resources.",
    content: null,
    status: "archived",
    domain: "publicgoods.nearbuilders.org",
    age: 96,
    updatedAge: 70,
  },
  {
    kind: "project",
    slug: "data-viz-playground",
    title: "Data Visualization Playground",
    ownerId: "data-labs.near",
    description: null,
    content: "## Overview\n\nSmall experiments that make ecosystem activity legible at a glance.",
    domain: null,
    age: 4,
    updatedAge: 2,
  },
  {
    kind: "project",
    slug: "builder-directory-api",
    title: "Builder Directory API",
    ownerId: "directory-labs.near",
    organizationId: "org-directory-labs",
    description: "A small API for profiles, capabilities, and collaboration signals.",
    content: "## Overview\n\nThe data layer behind a more useful builder directory.",
    visibility: "unlisted",
    domain: "api.directory-labs.org",
    age: 18,
    updatedAge: 7,
  },
  {
    kind: "project",
    slug: "near-mobile-toolkit",
    title: "NEAR Mobile Toolkit",
    ownerId: "mobileguild.near",
    organizationId: "org-mobileguild",
    description: "Starter flows for mobile wallets and account-aware applications.",
    content: "## Overview\n\nA paused toolkit for mobile account state and transaction handoff.",
    status: "paused",
    domain: "mobile.nearbuilders.org",
    age: 55,
    updatedAge: 23,
  },
  {
    kind: "project",
    slug: "grant-rounds-simulator",
    title: "Grant Rounds Simulator",
    ownerId: "commons.near",
    description: "A lightweight sandbox for testing grant allocation models.",
    content:
      "## Overview\n\nAn interactive simulator for comparing review and allocation strategies.",
    domain: null,
    age: 11,
    updatedAge: 9,
  },
  {
    kind: "project",
    slug: "private-client-portal",
    title: "Private Client Portal",
    ownerId: "studio-nine.near",
    organizationId: "org-studio-nine",
    description: "A private delivery space for a partner product team.",
    content: null,
    visibility: "private",
    domain: "portal.studio-nine.org",
    age: 6,
    updatedAge: 2,
  },
  {
    kind: "idea",
    slug: "near-learning-paths",
    title: "NEAR Learning Paths",
    ownerId: "learn-near.near",
    organizationId: "org-learn-near",
    description: "Guided routes through the ecosystem for builders at different starting points.",
    content:
      "## Opportunity\n\nCreate outcome-based learning paths instead of one large documentation maze. The first path could pair with @designguild.near/open-source-design-system.\n\n## Questions\n\n- Which first project should a new builder ship?\n- How do we keep paths current?",
    age: 3,
    updatedAge: 1,
  },
  {
    kind: "idea",
    slug: "intent-driven-bounties",
    title: "Intent-Driven Bounties",
    ownerId: "bounty-lab.near",
    description:
      "Bounties that start with a user outcome and leave room for multiple implementations.",
    content:
      "## Opportunity\n\nReplace prescriptive tickets with outcomes, constraints, and a review rubric.",
    age: 10,
    updatedAge: 6,
  },
  {
    kind: "idea",
    slug: "onchain-reputation-passport",
    title: "On-chain Reputation Passport",
    ownerId: "signal-house.near",
    organizationId: "org-signal-house",
    description: "Portable context for the work a builder has shipped and supported.",
    content:
      "## Opportunity\n\nExplore a reputation layer that favors verifiable work over vanity metrics.",
    status: "paused",
    domain: "passport.signal-house.org",
    age: 29,
    updatedAge: 15,
  },
  {
    kind: "idea",
    slug: "public-infra-coordination",
    title: "Public Infrastructure Coordination",
    ownerId: "relay-labs.near",
    organizationId: "org-relay-labs",
    description: "A shared queue for maintenance, ownership, and infrastructure handoffs.",
    content:
      "## Opportunity\n\nMake the invisible maintenance layer visible enough to pick up useful work.",
    age: 16,
    updatedAge: 8,
  },
  {
    kind: "idea",
    slug: "open-source-maintainer-fund",
    title: "Open Source Maintainer Fund",
    ownerId: "commons.near",
    description: "A small recurring fund for the people keeping shared tools healthy.",
    content:
      "## Opportunity\n\nPair transparent maintenance needs with recurring community support.",
    visibility: "unlisted",
    age: 38,
    updatedAge: 21,
  },
  {
    kind: "idea",
    slug: "community-coworking-map",
    title: "Community Coworking Map",
    ownerId: "city-labs.near",
    organizationId: "org-city-labs",
    description: "A living map of places where builders can meet, work, and host events.",
    content:
      "## Opportunity\n\nMake local builder communities easier to find without another social feed.",
    status: "archived",
    domain: "map.city-labs.org",
    age: 84,
    updatedAge: 61,
  },
  {
    kind: "idea",
    slug: "agent-tools-marketplace",
    title: "Agent Tools Marketplace",
    ownerId: "toolsmiths.near",
    organizationId: "org-toolsmiths",
    description: "A discoverable home for reusable tools, skills, and builder workflows.",
    content: "## Opportunity\n\nGive builders a reliable way to find and evaluate workflow tools.",
    repository: "https://github.com/nearbuilders/agent-tools-marketplace",
    domain: "tools.nearbuilders.org",
    age: 7,
    updatedAge: 3,
  },
  {
    kind: "idea",
    slug: "creator-royalty-router",
    title: "Creator Royalty Router",
    ownerId: "creator-labs.near",
    description: "A way for creators to route revenue across collaborators and public goods.",
    content:
      "## Opportunity\n\nMake revenue splits legible and programmable.\n\nThis entry is private while the economics are validated.",
    visibility: "private",
    age: 13,
    updatedAge: 4,
  },
  {
    kind: "idea",
    slug: "builder-residency-program",
    title: "Builder Residency Program",
    ownerId: "culture-labs.near",
    organizationId: "org-culture-labs",
    description: "A focused residency format for shipping one meaningful public-good project.",
    content:
      "## Opportunity\n\nCombine a clear project brief, peer support, and a public demo day.",
    status: "paused",
    age: 47,
    updatedAge: 30,
  },
  {
    kind: "idea",
    slug: "zero-knowledge-attestations",
    title: "Zero-Knowledge Attestations",
    ownerId: "proof-labs.near",
    description: "Selective proof of eligibility without exposing a full identity history.",
    content:
      "## Opportunity\n\nTest whether builders can prove a narrow claim without publishing all their context.",
    domain: "proofs.proof-labs.org",
    age: 22,
    updatedAge: 11,
  },
  {
    kind: "idea",
    slug: "protocol-health-digest",
    title: "Protocol Health Digest",
    ownerId: "signal-house.near",
    organizationId: "org-signal-house",
    description: "A concise recurring briefing for the metrics builders actually need.",
    content:
      "## Opportunity\n\nTurn scattered dashboards into a short, readable signal with source links.",
    age: 5,
    updatedAge: 2,
  },
  {
    kind: "idea",
    slug: "multilingual-builder-support",
    title: "Multilingual Builder Support",
    ownerId: "localize-near.near",
    description: "A community-supported path to better translated docs and local onboarding.",
    content:
      "## Opportunity\n\nSupport builders who do not start in English.\n\nThis concept is archived privately.",
    status: "archived",
    visibility: "private",
    age: 73,
    updatedAge: 50,
  },
  {
    kind: "scope",
    slug: "community-node-inventory",
    title: "Community Node Inventory",
    ownerId: "ops-collective.near",
    organizationId: "org-ops-collective",
    description: "A bounded inventory of community-operated infrastructure and its owners.",
    content:
      "## Scope\n\nDocument nodes, services, owners, and renewal dates that keep projects running.",
    age: 9,
    updatedAge: 4,
  },
  {
    kind: "scope",
    slug: "analytics-event-taxonomy",
    title: "Analytics Event Taxonomy",
    ownerId: "data-labs.near",
    organizationId: "org-data-labs",
    description: "A shared vocabulary for measuring product health without collecting everything.",
    content:
      "## Scope\n\nDefine reusable events, properties, and ownership rules for community products.",
    status: "paused",
    domain: "metrics.data-labs.org",
    age: 34,
    updatedAge: 20,
  },
  {
    kind: "scope",
    slug: "onboarding-friction-audit",
    title: "Onboarding Friction Audit",
    ownerId: "designguild.near",
    description: "A focused review of the moments where a new builder loses momentum.",
    content:
      "## Scope\n\nReview the path from first visit to first shipped contribution across docs and wallet setup.",
    age: 19,
    updatedAge: 13,
  },
  {
    kind: "scope",
    slug: "grant-review-workflow",
    title: "Grant Review Workflow",
    ownerId: "open-web.near",
    organizationId: "org-open-web",
    description:
      "A clear review flow with less coordination overhead for applicants and reviewers.",
    content:
      "## Scope\n\nMap intake, eligibility, review, decision, and follow-up into one flow.\n\nRelated: @commons.near/grant-rounds-simulator.",
    visibility: "unlisted",
    domain: "review.open-web.org",
    age: 28,
    updatedAge: 17,
  },
  {
    kind: "scope",
    slug: "public-goods-discovery",
    title: "Public Goods Discovery",
    ownerId: "good-work.near",
    description: "A narrower discovery experience for finding useful open work.",
    content:
      "## Scope\n\nDefine how a visitor browses, searches, filters, and understands project state.",
    status: "archived",
    age: 105,
    updatedAge: 83,
  },
  {
    kind: "scope",
    slug: "localization-readiness",
    title: "Localization Readiness",
    ownerId: "localize-near.near",
    organizationId: "org-localize-near",
    description: "The first practical pass at preparing shared UI and content for translation.",
    content:
      "## Scope\n\nAudit copy, formatting, ownership, and fallback behavior before adding a second language.",
    domain: "localize-near.org",
    age: 15,
    updatedAge: 6,
  },
  {
    kind: "scope",
    slug: "account-abstraction-research",
    title: "Account Abstraction Research",
    ownerId: "wallet-labs.near",
    description: "A research track on simpler account and transaction experiences.",
    content:
      "## Scope\n\nCompare wallet flows, delegated actions, recovery, and gas abstraction from a builder perspective.",
    age: 26,
    updatedAge: 9,
  },
  {
    kind: "scope",
    slug: "partner-api-boundaries",
    title: "Partner API Boundaries",
    ownerId: "studio-nine.near",
    organizationId: "org-studio-nine",
    description: "A private scope for separating partner behavior from shared platform code.",
    content:
      "## Scope\n\nInventory integration boundaries and identify the smallest stable contract for a partner pilot.",
    visibility: "private",
    age: 12,
    updatedAge: 3,
  },
  {
    kind: "result",
    slug: "near-builders-summit-recap",
    title: "NEAR Builders Summit Recap",
    ownerId: "buildguild.near",
    organizationId: "org-buildguild",
    description: "A concise record of what the community learned and decided together.",
    content:
      "## Result\n\nThe summit produced priorities for discovery, contribution paths, and maintenance ownership. See @buildguild.near/near-builders-starter-kit.",
    domain: "summit.nearbuilders.org",
    age: 1,
    updatedAge: 1,
  },
  {
    kind: "result",
    slug: "design-system-alpha",
    title: "Design System Alpha",
    ownerId: "designguild.near",
    organizationId: "org-designguild",
    description: "The first shared component release for the builder product family.",
    content:
      "## Result\n\nReleased the initial token set, core controls, and layout primitives with light and dark mode behavior.",
    status: "archived",
    domain: "alpha.designguild.org",
    age: 68,
    updatedAge: 44,
  },
  {
    kind: "result",
    slug: "first-grants-pilot",
    title: "First Grants Pilot",
    ownerId: "commons.near",
    description: "A completed pilot for making small community grants easier to follow.",
    content:
      "## Result\n\nThe pilot funded five projects and published a lightweight review record for every decision.",
    age: 33,
    updatedAge: 18,
  },
  {
    kind: "result",
    slug: "community-search-benchmark",
    title: "Community Search Benchmark",
    ownerId: "directory-labs.near",
    organizationId: "org-directory-labs",
    description: "A benchmark for whether visitors can find relevant work quickly.",
    content:
      "## Result\n\nTitle, type, owner, and status filters answered most first-session questions.",
    domain: "search.directory-labs.org",
    age: 24,
    updatedAge: 5,
  },
  {
    kind: "result",
    slug: "wallet-flow-study",
    title: "Wallet Flow Study",
    ownerId: "wallet-labs.near",
    description: "Research findings from testing account connection and return paths.",
    content:
      "## Result\n\nVisitors understand the first transaction faster when account context follows the project goal.",
    status: "paused",
    visibility: "unlisted",
    age: 40,
    updatedAge: 27,
  },
  {
    kind: "result",
    slug: "open-data-release",
    title: "Open Data Release",
    ownerId: "data-labs.near",
    organizationId: "org-data-labs",
    description: "A versioned release of cleaned ecosystem data for community analysis.",
    content:
      "## Result\n\nPublished documented data with a changelog, schema notes, and example queries.",
    domain: "data-release.data-labs.org",
    age: 17,
    updatedAge: 6,
  },
  {
    kind: "result",
    slug: "operator-playbook",
    title: "Community Operator Playbook",
    ownerId: "ops-collective.near",
    description: "A practical handoff guide for running small community services.",
    content:
      "## Result\n\nCaptured recurring checks, escalation paths, and ownership handoffs previously held in private notes.",
    status: "archived",
    age: 118,
    updatedAge: 91,
  },
  {
    kind: "result",
    slug: "private-client-launch",
    title: "Private Client Launch",
    ownerId: "studio-nine.near",
    organizationId: "org-studio-nine",
    description: "A private delivery record for a recently launched partner experience.",
    content:
      "## Result\n\nThe partner launch is complete and the team is collecting post-launch feedback.",
    visibility: "private",
    domain: "client.studio-nine.org",
    age: 20,
    updatedAge: 2,
  },
];

const seedProjects: ProjectRow[] = entrySpecs.map((entry) => ({
  id: seedProjectId(entry.slug),
  ownerId: entry.ownerId,
  organizationId: entry.organizationId ?? null,
  kind: entry.kind,
  slug: entry.slug,
  title: entry.title,
  description: entry.description ?? null,
  content:
    entry.content === undefined
      ? entry.kind === "project"
        ? null
        : defaultContent(entry.kind, entry.title)
      : entry.content,
  status: entry.status ?? "active",
  visibility: entry.visibility ?? "public",
  repository:
    entry.repository === undefined
      ? entry.kind === "project"
        ? `https://github.com/nearbuilders/${entry.slug}`
        : null
      : entry.repository,
  domain: entry.domain ?? null,
  createdAt: daysAgo(entry.age),
  updatedAt: daysAgo(entry.updatedAge ?? entry.age),
}));

const appSeeds = [
  [
    "seed-app-starter-kit",
    "near-builders-starter-kit",
    "buildguild.near",
    "starter.nearbuilders.org",
  ],
  [
    "seed-app-grants-dashboard",
    "community-grants-dashboard",
    "open-web.near",
    "grants.nearbuilders.org",
  ],
  [
    "seed-app-design-system",
    "open-source-design-system",
    "designguild.near",
    "design.nearbuilders.org",
  ],
  ["seed-app-data-lab", "near-data-lab", "data-labs.near", "data.nearbuilders.org"],
].map(([id, slug, accountId, domain]) => ({
  id,
  projectId: seedProjectId(slug),
  accountId,
  domain,
  createdByUserId: accountId,
  createdAt: daysAgo(1),
}));

const mentionSeeds = [
  [
    "seed-mention-starter-kit-data-lab",
    "near-builders-starter-kit",
    "data-labs.near",
    "near-data-lab",
  ],
  [
    "seed-mention-learning-paths-design-system",
    "near-learning-paths",
    "designguild.near",
    "open-source-design-system",
  ],
  [
    "seed-mention-grant-review-simulator",
    "grant-review-workflow",
    "commons.near",
    "grant-rounds-simulator",
  ],
  [
    "seed-mention-summit-starter-kit",
    "near-builders-summit-recap",
    "buildguild.near",
    "near-builders-starter-kit",
  ],
].map(([id, sourceSlug, targetOwnerId, targetSlug]) => ({
  id,
  sourceId: seedProjectId(sourceSlug),
  targetOwnerId,
  targetSlug,
  targetId: seedProjectId(targetSlug),
  createdAt: daysAgo(1),
}));

const voteCounts = [
  12, 8, 6, 2, 0, 10, 3, 7, 1, 4, 9, 5, 11, 3, 0, 6, 2, 8, 4, 1, 7, 5, 10, 3, 2, 6, 4, 9, 1, 5, 8,
  2, 13, 6, 3, 11, 4, 7, 2, 9,
];

async function seedProjectsDatabase(databaseUrl: string) {
  const driver = await createProjectsDatabaseDriver(databaseUrl);

  try {
    const insertedProjects = await driver.db
      .insert(projects)
      .values(seedProjects)
      .onConflictDoNothing()
      .returning({ id: projects.id });
    const seededIds = await driver.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        inArray(
          projects.id,
          seedProjects.map((project) => project.id),
        ),
      );
    const seededIdSet = new Set(seededIds.map((project) => project.id));
    const appRows = appSeeds.filter((app) => seededIdSet.has(app.projectId));
    const insertedApps =
      appRows.length > 0
        ? await driver.db
            .insert(projectApps)
            .values(appRows)
            .onConflictDoNothing()
            .returning({ id: projectApps.id })
        : [];
    const mentionRows = mentionSeeds
      .filter((mention) => seededIdSet.has(mention.sourceId))
      .map((mention) => ({
        ...mention,
        targetId: seededIdSet.has(mention.targetId) ? mention.targetId : null,
      }));
    const insertedMentions =
      mentionRows.length > 0
        ? await driver.db
            .insert(projectMentions)
            .values(mentionRows)
            .onConflictDoNothing()
            .returning({ id: projectMentions.id })
        : [];
    const [total] = await driver.db.select({ value: count() }).from(projects);

    console.log(
      `Projects seed: +${insertedProjects.length} projects, +${insertedApps.length} apps, +${insertedMentions.length} mentions; ${Number(total?.value ?? 0)} total project entries`,
    );
  } finally {
    await driver.close();
  }
}

async function seedVotesDatabase(databaseUrl: string) {
  const driver = await createVotesDatabaseDriver(databaseUrl);
  const voteRows = seedProjects.flatMap((project, projectIndex) =>
    Array.from({ length: voteCounts[projectIndex] ?? 0 }, (_, voterIndex) => ({
      id: `seed-vote-${project.slug}-${voterIndex + 1}`,
      entityId: project.id,
      userId: `seed-voter-${voterIndex + 1}`,
      createdAt: daysAgo((projectIndex % 8) + voterIndex / 10 + 1),
    })),
  );

  try {
    const insertedVotes = await driver.db
      .insert(upvotes)
      .values(voteRows)
      .onConflictDoNothing()
      .returning({ id: upvotes.id });
    const [total] = await driver.db.select({ value: count() }).from(upvotes);

    console.log(
      `Votes seed: +${insertedVotes.length} endorsements; ${Number(total?.value ?? 0)} total endorsements`,
    );
  } finally {
    await driver.close();
  }
}

const projectsDatabaseUrl = process.env.PROJECTS_DATABASE_URL;
const votesDatabaseUrl = process.env.VOTES_DATABASE_URL;

if (!projectsDatabaseUrl) {
  throw new Error("PROJECTS_DATABASE_URL is required to seed demo data");
}

await seedProjectsDatabase(projectsDatabaseUrl);

if (votesDatabaseUrl) {
  await seedVotesDatabase(votesDatabaseUrl);
} else {
  console.log("Votes seed skipped: VOTES_DATABASE_URL is not configured");
}
