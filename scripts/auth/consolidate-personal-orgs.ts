/**
 * Consolidate duplicate personal organizations in the auth database.
 *
 * Personal orgs are identified by the auth plugin's lenient predicate:
 * parsed `metadata.isPersonal === true` OR `slug === userId`. The upstream
 * finder requires the byte-exact canonical form, so drifted rows silently
 * produce duplicates on the next signup. This script converges every user
 * onto one canonical personal org and re-points everything that referenced
 * the duplicates. See NEARBuilders/everything-dev#877 for the root cause.
 *
 * Usage (from the repo root):
 *   pnpm exec tsx scripts/auth/consolidate-personal-orgs.ts           # dry run (report only)
 *   pnpm exec tsx scripts/auth/consolidate-personal-orgs.ts --apply   # execute
 *   pnpm exec tsx scripts/auth/consolidate-personal-orgs.ts --self-test
 *
 * Env:
 *   AUTH_DATABASE_URL      required (unless --self-test) — postgres:// connection string,
 *                          or a pglite: data dir (local dev)
 *   PROJECTS_DATABASE_URL  optional — same formats; when present, projects attributed to a
 *                          duplicate are re-pointed to the surviving org. Without it, affected
 *                          projects are reported and left untouched.
 *
 * Default mode is a dry run: it only reports. --apply executes the consolidation,
 * one transaction per affected user on the auth DB, then re-points projects.
 * Safe to re-run: a converged database reports nothing to do.
 * --self-test builds the adversarial fixture in in-memory PGlite and asserts
 * every consolidation outcome — no external database required.
 */
import "dotenv/config";
import { Client } from "pg";

const CANONICAL_METADATA = JSON.stringify({ isPersonal: true });

const APPLY = process.argv.includes("--apply");
const SELF_TEST = process.argv.includes("--self-test");

type QueryResult<T> = { rows: T[]; rowCount: number | null };

type DbClient = Queryable & { end(): Promise<void> };

type Queryable = {
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  metadata: string | null;
  status: string;
  createdAt: Date;
};

type MemberRow = { userId: string; role: string };

type OrgWithMembers = OrgRow & { members: MemberRow[] };

type Group = {
  userId: string;
  userName: string | null;
  keeper: OrgWithMembers;
  dupes: OrgWithMembers[];
  needsCanonicalization: boolean;
};

type References = {
  teams: number;
  teamMembers: number;
  sessions: number;
  pendingInvitations: number;
  orgApiKeys: number;
  onboardingCodes: number;
};

type ProjectRow = { id: string; slug: string; organization_id: string };

type ApplyStats = {
  teamsMoved: number;
  teamsMerged: number;
  teamMembersMoved: number;
  membersMoved: number;
  membersDeduped: number;
  sessionsRepointed: number;
  usersRepointed: number;
  orgApiKeysRepointed: number;
  onboardingCodesRepointed: number;
  pendingInvitationsDeleted: number;
  orgsDeleted: number;
};

function parseIsPersonal(metadata: string | null | undefined): boolean {
  if (!metadata) return false;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return (parsed as { isPersonal?: unknown }).isPersonal === true;
    }
  } catch {
    return false;
  }
  return false;
}

function isLenientPersonal(org: Pick<OrgRow, "slug" | "metadata">, userId: string): boolean {
  return parseIsPersonal(org.metadata) || org.slug === userId;
}

function isStrictCanonical(org: Pick<OrgRow, "slug" | "metadata">, userId: string): boolean {
  return org.slug === userId && org.metadata === CANONICAL_METADATA;
}

function pickKeeper(userId: string, orgs: OrgWithMembers[]): OrgWithMembers {
  const strict = orgs.find((org) => isStrictCanonical(org, userId));
  if (strict) return strict;
  return [...orgs].sort((a, b) => {
    const byMembers = b.members.length - a.members.length;
    if (byMembers !== 0) return byMembers;
    const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
    if (byCreated !== 0) return byCreated;
    return a.id.localeCompare(b.id);
  })[0];
}

async function openPostgres(url: string): Promise<DbClient> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return {
    query: async <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.rowCount };
    },
    end: () => client.end(),
  };
}

async function openPglite(url: string): Promise<DbClient> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = url.startsWith("pglite:") ? url.slice("pglite:".length) : url;
  const db = new PGlite(dataDir.length > 0 ? dataDir : undefined);
  await db.waitReady;
  return {
    query: async <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const result = await db.query<Record<string, unknown>>(sql, params);
      return {
        rows: result.rows as T[],
        rowCount: result.affectedRows ?? null,
      };
    },
    end: () => db.close(),
  };
}

async function openDatabase(label: string, url: string | undefined): Promise<DbClient> {
  if (!url) {
    throw new Error(`${label} is required — e.g. postgres://... or pglite:.bos/db/auth`);
  }
  if (url.startsWith("pglite:") || url.startsWith("memory://")) {
    return openPglite(url);
  }
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return openPostgres(url);
  }
  throw new Error(`${label} must be a postgres:// connection string or a pglite: data dir`);
}

async function loadPersonalGroups(
  auth: Queryable,
): Promise<{ groups: Group[]; anomalies: string[] }> {
  const users = await auth.query<{ id: string; name: string }>(`SELECT id, name FROM "user"`);
  const userExists = new Set(users.rows.map((row) => row.id));
  const nameById = new Map(users.rows.map((row) => [row.id, row.name]));

  const rows = await auth.query<{
    org_id: string;
    slug: string;
    org_name: string;
    metadata: string | null;
    status: string;
    created_at: Date;
    user_id: string | null;
    role: string | null;
  }>(`
    SELECT o.id AS org_id, o.slug, o.name AS org_name, o.metadata, o.status, o.created_at,
           m.user_id, m.role
    FROM organization o
    LEFT JOIN member m ON m.organization_id = o.id
    WHERE o.slug IN (SELECT id FROM "user") OR o.metadata LIKE '%isPersonal%'
    ORDER BY o.created_at, o.id
  `);

  const orgs = new Map<string, OrgWithMembers>();
  for (const row of rows.rows) {
    let org = orgs.get(row.org_id);
    if (!org) {
      org = {
        id: row.org_id,
        slug: row.slug,
        name: row.org_name,
        metadata: row.metadata,
        status: row.status,
        createdAt: new Date(row.created_at),
        members: [],
      };
      orgs.set(row.org_id, org);
    }
    if (row.user_id && row.role) {
      org.members.push({ userId: row.user_id, role: row.role });
    }
  }

  const anomalies: string[] = [];
  const byUser = new Map<string, OrgWithMembers[]>();

  for (const org of orgs.values()) {
    const ownerMembers = org.members.filter((member) => member.role.split(",").includes("owner"));
    let userId: string | null = null;

    if (ownerMembers.length > 1) {
      anomalies.push(
        `org ${org.id} (slug "${org.slug}") has ${ownerMembers.length} owner members — skipping, resolve manually`,
      );
      continue;
    }

    if (ownerMembers.length === 1) {
      userId = ownerMembers[0].userId;
      if (org.slug !== userId && userExists.has(org.slug)) {
        anomalies.push(
          `org ${org.id} (slug "${org.slug}") is owned by ${userId} but its slug matches another user id`,
        );
      }
    } else if (userExists.has(org.slug)) {
      userId = org.slug;
    } else if (parseIsPersonal(org.metadata)) {
      anomalies.push(
        `org ${org.id} (slug "${org.slug}") has personal metadata but no owner member and its slug is not a user id — skipping`,
      );
      continue;
    }

    if (!userId || !userExists.has(userId) || !isLenientPersonal(org, userId)) {
      continue;
    }

    const list = byUser.get(userId) ?? [];
    list.push(org);
    byUser.set(userId, list);
  }

  const groups: Group[] = [];
  for (const [userId, orgsForUser] of byUser) {
    const keeper = pickKeeper(userId, orgsForUser);
    const dupes = orgsForUser.filter((org) => org.id !== keeper.id);
    const needsCanonicalization = !isStrictCanonical(keeper, userId);
    if (dupes.length === 0 && !needsCanonicalization) continue;
    groups.push({
      userId,
      userName: nameById.get(userId) ?? null,
      keeper,
      dupes,
      needsCanonicalization,
    });
  }

  groups.sort((a, b) => a.userId.localeCompare(b.userId));
  return { groups, anomalies };
}

async function loadReferences(auth: Queryable, dupes: string[]): Promise<References> {
  const result = await auth.query<{
    teams: number;
    team_members: number;
    sessions: number;
    pending_invitations: number;
    org_api_keys: number;
    onboarding_codes: number;
  }>(
    `
    SELECT
      (SELECT count(*)::int FROM team WHERE organization_id = ANY($1)) AS teams,
      (SELECT count(*)::int FROM team_member tm JOIN team t ON t.id = tm.team_id
        WHERE t.organization_id = ANY($1)) AS team_members,
      (SELECT count(*)::int FROM session WHERE active_organization_id = ANY($1)) AS sessions,
      (SELECT count(*)::int FROM invitation WHERE organization_id = ANY($1)
        AND status = 'pending') AS pending_invitations,
      (SELECT count(*)::int FROM apikey WHERE config_id = 'org-keys'
        AND reference_id = ANY($1)) AS org_api_keys,
      (SELECT count(*)::int FROM onboarding_code WHERE organization_id = ANY($1)) AS onboarding_codes
  `,
    [dupes],
  );
  const row = result.rows[0];
  return {
    teams: row.teams,
    teamMembers: row.team_members,
    sessions: row.sessions,
    pendingInvitations: row.pending_invitations,
    orgApiKeys: row.org_api_keys,
    onboardingCodes: row.onboarding_codes,
  };
}

async function loadDupeProjects(projects: Queryable, dupes: string[]): Promise<ProjectRow[]> {
  const result = await projects.query<ProjectRow>(
    `SELECT id, slug, organization_id FROM projects WHERE organization_id = ANY($1)`,
    [dupes],
  );
  return result.rows;
}

async function applyGroup(auth: Queryable, group: Group): Promise<ApplyStats> {
  const stats: ApplyStats = {
    teamsMoved: 0,
    teamsMerged: 0,
    teamMembersMoved: 0,
    membersMoved: 0,
    membersDeduped: 0,
    sessionsRepointed: 0,
    usersRepointed: 0,
    orgApiKeysRepointed: 0,
    onboardingCodesRepointed: 0,
    pendingInvitationsDeleted: 0,
    orgsDeleted: 0,
  };
  const keeperId = group.keeper.id;
  const dupeIds = group.dupes.map((org) => org.id);
  const deletedTeamIds: string[] = [];

  await auth.query("BEGIN");
  try {
    for (const dupe of dupeIds) {
      const dupeTeams = await auth.query<{ id: string; event_id: string | null }>(
        `SELECT id, event_id FROM team WHERE organization_id = $1`,
        [dupe],
      );
      for (const dupeTeam of dupeTeams.rows) {
        let mergedInto: string | null = null;
        if (dupeTeam.event_id !== null) {
          const collision = await auth.query<{ id: string }>(
            `SELECT id FROM team WHERE organization_id = $1 AND event_id = $2 LIMIT 1`,
            [keeperId, dupeTeam.event_id],
          );
          if (collision.rows.length > 0) mergedInto = collision.rows[0].id;
        }

        if (mergedInto) {
          await auth.query(`UPDATE onboarding_code SET team_id = $2 WHERE team_id = $1`, [
            dupeTeam.id,
            mergedInto,
          ]);
          const moved = await auth.query<{ rowCount: number | null }>(
            `UPDATE team_member SET team_id = $2
             WHERE team_id = $1
               AND user_id NOT IN (SELECT user_id FROM team_member WHERE team_id = $2)`,
            [dupeTeam.id, mergedInto],
          );
          stats.teamMembersMoved += moved.rowCount ?? 0;
          await auth.query(`DELETE FROM team WHERE id = $1`, [dupeTeam.id]);
          deletedTeamIds.push(dupeTeam.id);
          stats.teamsMerged += 1;
        } else {
          await auth.query(`UPDATE team SET organization_id = $2 WHERE id = $1`, [
            dupeTeam.id,
            keeperId,
          ]);
          stats.teamsMoved += 1;
        }
      }
    }

    const deduped = await auth.query<{ rowCount: number | null }>(
      `DELETE FROM member
       WHERE organization_id = ANY($1)
         AND user_id IN (SELECT user_id FROM member WHERE organization_id = $2)`,
      [dupeIds, keeperId],
    );
    stats.membersDeduped = deduped.rowCount ?? 0;

    const movedMembers = await auth.query<{ rowCount: number | null }>(
      `UPDATE member SET organization_id = $2 WHERE organization_id = ANY($1)`,
      [dupeIds, keeperId],
    );
    stats.membersMoved = movedMembers.rowCount ?? 0;

    const deletedInvites = await auth.query<{ rowCount: number | null }>(
      `DELETE FROM invitation WHERE organization_id = ANY($1) AND status = 'pending'`,
      [dupeIds],
    );
    stats.pendingInvitationsDeleted = deletedInvites.rowCount ?? 0;

    const repointedSessions = await auth.query<{ rowCount: number | null }>(
      `UPDATE session SET active_organization_id = $2 WHERE active_organization_id = ANY($1)`,
      [dupeIds, keeperId],
    );
    stats.sessionsRepointed = repointedSessions.rowCount ?? 0;

    const repointedUsers = await auth.query<{ rowCount: number | null }>(
      `UPDATE "user" SET last_active_organization_id = $2 WHERE last_active_organization_id = ANY($1)`,
      [dupeIds, keeperId],
    );
    stats.usersRepointed = repointedUsers.rowCount ?? 0;

    if (deletedTeamIds.length > 0) {
      await auth.query(`UPDATE session SET active_team_id = NULL WHERE active_team_id = ANY($1)`, [
        deletedTeamIds,
      ]);
      await auth.query(
        `UPDATE "user" SET last_active_team_id = NULL WHERE last_active_team_id = ANY($1)`,
        [deletedTeamIds],
      );
    }

    const repointedKeys = await auth.query<{ rowCount: number | null }>(
      `UPDATE apikey SET reference_id = $2, updated_at = now()
       WHERE config_id = 'org-keys' AND reference_id = ANY($1)`,
      [dupeIds, keeperId],
    );
    stats.orgApiKeysRepointed = repointedKeys.rowCount ?? 0;

    const repointedCodes = await auth.query<{ rowCount: number | null }>(
      `UPDATE onboarding_code SET organization_id = $2 WHERE organization_id = ANY($1)`,
      [dupeIds, keeperId],
    );
    stats.onboardingCodesRepointed = repointedCodes.rowCount ?? 0;

    const deletedOrgs = await auth.query<{ rowCount: number | null }>(
      `DELETE FROM organization WHERE id = ANY($1)`,
      [dupeIds],
    );
    stats.orgsDeleted = deletedOrgs.rowCount ?? 0;

    if (group.needsCanonicalization) {
      const nextName = group.userName?.trim() || "Personal";
      await auth.query(
        `UPDATE organization SET slug = $2, metadata = $3, status = 'active', name = $4 WHERE id = $1`,
        [keeperId, group.userId, CANONICAL_METADATA, nextName],
      );
    }

    const existingOwner = await auth.query<{ id: string; role: string }>(
      `SELECT id, role FROM member WHERE organization_id = $1 AND user_id = $2`,
      [keeperId, group.userId],
    );
    if (existingOwner.rows.length === 0) {
      await auth.query(
        `INSERT INTO member (id, organization_id, user_id, role, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'owner', now())`,
        [keeperId, group.userId],
      );
    } else if (!existingOwner.rows[0].role.split(",").includes("owner")) {
      await auth.query(`UPDATE member SET role = 'owner' WHERE id = $1`, [
        existingOwner.rows[0].id,
      ]);
    }

    await auth.query("COMMIT");
  } catch (error) {
    await auth.query("ROLLBACK");
    throw error;
  }

  return stats;
}

async function repointProjects(
  projects: Queryable,
  group: Group,
): Promise<{ moved: ProjectRow[] }> {
  const dupeIds = group.dupes.map((org) => org.id);
  const moved = await projects.query<ProjectRow>(
    `UPDATE projects SET organization_id = $2, updated_at = now()
     WHERE organization_id = ANY($1)
     RETURNING id, slug, organization_id`,
    [dupeIds, group.keeper.id],
  );
  return { moved: moved.rows };
}

function describeOrg(org: OrgWithMembers): string {
  const meta = parseIsPersonal(org.metadata) ? "personal" : "slug-only";
  const canonical = org.metadata === CANONICAL_METADATA ? "canonical" : "drifted";
  return `${org.id} (slug "${org.slug}", ${meta}/${canonical}, ${org.members.length} members, created ${org.createdAt.toISOString()})`;
}

function emptyStats(): ApplyStats {
  return {
    teamsMoved: 0,
    teamsMerged: 0,
    teamMembersMoved: 0,
    membersMoved: 0,
    membersDeduped: 0,
    sessionsRepointed: 0,
    usersRepointed: 0,
    orgApiKeysRepointed: 0,
    onboardingCodesRepointed: 0,
    pendingInvitationsDeleted: 0,
    orgsDeleted: 0,
  };
}

async function runConsolidation(
  auth: Queryable,
  projects: Queryable | null,
  apply: boolean,
): Promise<void> {
  if (!apply) {
    console.log("DRY RUN — no changes will be made. Re-run with --apply to execute.\n");
  }

  const { groups, anomalies } = await loadPersonalGroups(auth);

  for (const anomaly of anomalies) {
    console.log(`ANOMALY: ${anomaly}`);
  }
  if (anomalies.length > 0) console.log();

  if (groups.length === 0) {
    console.log("No drifted or duplicate personal organizations found. Nothing to do.");
    return;
  }

  const withDupes = groups.filter((group) => group.dupes.length > 0);
  const canonicalizationOnly = groups.length - withDupes.length;

  console.log(
    `Found ${groups.length} user(s) with drifted personal organizations: ` +
      `${withDupes.length} with duplicates, ${canonicalizationOnly} needing canonicalization only.\n`,
  );

  const totals = emptyStats();
  let projectsMovedTotal = 0;

  for (const group of groups) {
    console.log(`user ${group.userId} (${group.userName ?? "unknown name"})`);
    console.log(`  keeper: ${describeOrg(group.keeper)}`);

    const references =
      group.dupes.length > 0
        ? await loadReferences(
            auth,
            group.dupes.map((org) => org.id),
          )
        : null;
    const dupeProjects =
      group.dupes.length > 0 && projects
        ? await loadDupeProjects(
            projects,
            group.dupes.map((org) => org.id),
          )
        : [];

    for (const dupe of group.dupes) {
      console.log(`  delete: ${describeOrg(dupe)}`);
    }
    if (references) {
      console.log(
        `  references on duplicates: ` +
          `teams ${references.teams} (${references.teamMembers} members), ` +
          `sessions ${references.sessions}, pending invitations ${references.pendingInvitations}, ` +
          `org API keys ${references.orgApiKeys}, onboarding codes ${references.onboardingCodes}`,
      );
      if (projects) {
        console.log(
          `  projects on duplicates: ${dupeProjects.length}` +
            (dupeProjects.length > 0 ? ` (${dupeProjects.map((p) => p.slug).join(", ")})` : ""),
        );
      } else {
        console.log(
          `  projects on duplicates: UNKNOWN — set PROJECTS_DATABASE_URL to inspect and re-point them`,
        );
      }
    }
    if (group.dupes.length === 0 && group.needsCanonicalization) {
      console.log(
        `  action: canonicalize keeper (slug/metadata/status) so the auth plugin finds it`,
      );
    }
    console.log();

    if (!apply) continue;

    if (group.dupes.length > 0) {
      const stats = await applyGroup(auth, group);
      for (const key of Object.keys(totals) as Array<keyof ApplyStats>) {
        totals[key] += stats[key];
      }
      console.log(
        `  applied: deleted ${stats.orgsDeleted} org(s), moved ${stats.membersMoved} member row(s) ` +
          `(${stats.membersDeduped} duplicate row(s) removed), teams moved ${stats.teamsMoved} / merged ${stats.teamsMerged}, ` +
          `sessions ${stats.sessionsRepointed}, users ${stats.usersRepointed}, api keys ${stats.orgApiKeysRepointed}, ` +
          `onboarding codes ${stats.onboardingCodesRepointed}, pending invitations deleted ${stats.pendingInvitationsDeleted}`,
      );
    } else {
      await applyGroup(auth, group);
      console.log(`  applied: canonicalized keeper`);
    }

    if (projects && group.dupes.length > 0) {
      const { moved } = await repointProjects(projects, group);
      projectsMovedTotal += moved.length;
      if (moved.length > 0) {
        console.log(`  projects re-pointed: ${moved.map((p) => p.slug).join(", ")}`);
      }
    }
    console.log();
  }

  if (!apply) {
    console.log("DRY RUN complete. Re-run with --apply to execute.");
    return;
  }

  console.log(
    `Done. Orgs deleted ${totals.orgsDeleted}, members moved ${totals.membersMoved} ` +
      `(${totals.membersDeduped} deduped), teams moved ${totals.teamsMoved} / merged ${totals.teamsMerged} ` +
      `(${totals.teamMembersMoved} team members moved), sessions ${totals.sessionsRepointed}, ` +
      `users ${totals.usersRepointed}, org API keys ${totals.orgApiKeysRepointed}, ` +
      `onboarding codes ${totals.onboardingCodesRepointed}, ` +
      `pending invitations deleted ${totals.pendingInvitationsDeleted}, projects re-pointed ${projectsMovedTotal}.`,
  );
  if (!projects && withDupes.length > 0) {
    console.log(
      "Note: PROJECTS_DATABASE_URL was not set — any projects attributed to deleted orgs are now dangling. " +
        "Re-point them via the admin dashboard or re-run with PROJECTS_DATABASE_URL set.",
    );
  }
}

const AUTH_TEST_SCHEMA = `
CREATE TABLE "user" (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, last_active_organization_id text, last_active_team_id text);
CREATE TABLE organization (id text PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE, metadata text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE member (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'member', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE team (id text PRIMARY KEY, name text NOT NULL, organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE, event_id text, member_count int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT team_org_event_uq UNIQUE (organization_id, event_id));
CREATE TABLE team_member (id text PRIMARY KEY, team_id text NOT NULL REFERENCES team(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, membership_key text UNIQUE, role text NOT NULL DEFAULT 'member', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE session (id text PRIMARY KEY, token text NOT NULL UNIQUE, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, active_organization_id text, active_team_id text, expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days');
CREATE TABLE invitation (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE, email text NOT NULL, role text, status text NOT NULL DEFAULT 'pending', expires_at timestamptz NOT NULL, inviter_id text NOT NULL);
CREATE TABLE apikey (id text PRIMARY KEY, config_id text NOT NULL DEFAULT 'default', reference_id text NOT NULL, key text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE onboarding_code (id text PRIMARY KEY, code_hash text NOT NULL, organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE, event_id text, event_name text NOT NULL, team_id text NOT NULL REFERENCES team(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
`;

const AUTH_TEST_FIXTURE = `
INSERT INTO "user" (id, name, email) VALUES
 ('u1','Alice','alice@example.com'),
 ('u2','Bob','bob@example.com'),
 ('u3','Carol','carol@example.com'),
 ('u4','Dana','dana@example.com'),
 ('u5','Eve','eve@example.com');
INSERT INTO organization (id, name, slug, metadata, created_at) VALUES
 ('orgA','Alice','u1','{"isPersonal":true}', now() - interval '10 days'),
 ('orgB','Alice Personal','alice-personal','{"isPersonal": true}', now() - interval '5 days'),
 ('orgD','Bob','u2','{"isPersonal": true}', now() - interval '4 days'),
 ('orgC','Carol','u3','{"isPersonal":true}', now() - interval '3 days'),
 ('orgE','Dana org','dana-org','{"isPersonal":true}', now() - interval '2 days');
INSERT INTO member (id, organization_id, user_id, role) VALUES
 ('mA1','orgA','u1','owner'),
 ('mB1','orgB','u1','owner'),
 ('mB2','orgB','u2','member'),
 ('mD1','orgD','u2','owner'),
 ('mC1','orgC','u3','owner'),
 ('mE1','orgE','u4','owner'),
 ('mE2','orgE','u5','owner');
INSERT INTO team (id, name, organization_id, event_id) VALUES
 ('T2','Alice team','orgA','evt-1'),
 ('T3','Alice event team','orgB','evt-1'),
 ('T1','Alice casual','orgB',NULL);
INSERT INTO team_member (id, team_id, user_id) VALUES
 ('tm2','T2','u1'),
 ('tm3a','T3','u1'),
 ('tm3b','T3','u2');
INSERT INTO session (id, token, user_id, active_organization_id, active_team_id) VALUES
 ('s1','tok1','u1','orgB','T3'),
 ('s2','tok2','u2','orgD',NULL);
UPDATE "user" SET last_active_organization_id='orgB' WHERE id='u1';
UPDATE "user" SET last_active_organization_id='orgD' WHERE id='u2';
INSERT INTO invitation (id, organization_id, email, inviter_id, expires_at) VALUES
 ('inv1','orgB','friend@example.com','u1', now() + interval '3 days');
INSERT INTO apikey (id, config_id, reference_id, key) VALUES
 ('k1','org-keys','orgB','hash-b'),
 ('k2','user-keys','u1','hash-u1');
INSERT INTO onboarding_code (id, code_hash, organization_id, event_id, event_name, team_id, expires_at) VALUES
 ('oc1','h1','orgB','evt-1','Launch','T3', now() + interval '30 days');
`;

const PROJECTS_TEST_SCHEMA = `
CREATE TABLE projects (id text PRIMARY KEY, slug text NOT NULL, organization_id text, updated_at timestamptz NOT NULL DEFAULT now());
`;

const PROJECTS_TEST_FIXTURE = `
INSERT INTO projects (id, slug, organization_id) VALUES
 ('p1','proj-one','orgB'),
 ('p2','proj-two','orgA'),
 ('p3','proj-three','orgD');
`;

async function selfTest(): Promise<void> {
  const { PGlite } = await import("@electric-sql/pglite");

  const auth = new PGlite();
  const projectsDb = new PGlite();
  await auth.exec(AUTH_TEST_SCHEMA + AUTH_TEST_FIXTURE);
  await projectsDb.exec(PROJECTS_TEST_SCHEMA + PROJECTS_TEST_FIXTURE);

  const wrap = (db: InstanceType<typeof PGlite>): DbClient => ({
    query: async <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const result = await db.query<Record<string, unknown>>(sql, params);
      return { rows: result.rows as T[], rowCount: result.affectedRows ?? null };
    },
    end: () => db.close(),
  });

  const authClient = wrap(auth);
  const projectsClient = wrap(projectsDb);

  console.log("self-test: dry run over adversarial fixture");
  await runConsolidation(authClient, projectsClient, false);

  console.log("\nself-test: apply");
  await runConsolidation(authClient, projectsClient, true);

  const single = async (sql: string): Promise<string> => {
    const result = await authClient.query<Record<string, unknown>>(sql);
    return String(result.rows[0]?.value ?? "");
  };

  const checks: Array<{ label: string; actual: Promise<string>; expected: string }> = [
    {
      label: "duplicate org deleted",
      actual: single(`SELECT count(*)::text AS value FROM organization WHERE id = 'orgB'`),
      expected: "0",
    },
    {
      label: "keeper canonical metadata",
      actual: single(`SELECT metadata AS value FROM organization WHERE id = 'orgA'`),
      expected: CANONICAL_METADATA,
    },
    {
      label: "single drifted org canonicalized",
      actual: single(
        `SELECT metadata || '|' || slug || '|' || name AS value FROM organization WHERE id = 'orgD'`,
      ),
      expected: `${CANONICAL_METADATA}|u2|Bob`,
    },
    {
      label: "ambiguous-owner org untouched",
      actual: single(
        `SELECT slug || '|' || (SELECT count(*)::text FROM member WHERE organization_id = 'orgE') AS value FROM organization WHERE id = 'orgE'`,
      ),
      expected: "dana-org|2",
    },
    {
      label: "cross-user member moved to keeper",
      actual: single(
        `SELECT role || '|' || organization_id AS value FROM member WHERE user_id = 'u2' AND organization_id = 'orgA'`,
      ),
      expected: "member|orgA",
    },
    {
      label: "keeper ownership preserved",
      actual: single(
        `SELECT role AS value FROM member WHERE organization_id = 'orgA' AND user_id = 'u1'`,
      ),
      expected: "owner",
    },
    {
      label: "teams converged on keeper",
      actual: single(
        `SELECT string_agg(id, ',' ORDER BY id) AS value FROM team WHERE organization_id = 'orgA'`,
      ),
      expected: "T1,T2",
    },
    {
      label: "event-collision team merged away",
      actual: single(`SELECT count(*)::text AS value FROM team WHERE id = 'T3'`),
      expected: "0",
    },
    {
      label: "merged team members moved, duplicates skipped",
      actual: single(
        `SELECT string_agg(user_id, ',' ORDER BY user_id) AS value FROM team_member WHERE team_id = 'T2'`,
      ),
      expected: "u1,u2",
    },
    {
      label: "session re-pointed to keeper",
      actual: single(`SELECT active_organization_id AS value FROM session WHERE id = 's1'`),
      expected: "orgA",
    },
    {
      label: "session team pointer cleared for merged team",
      actual: single(
        `SELECT coalesce(active_team_id, 'NULL') AS value FROM session WHERE id = 's1'`,
      ),
      expected: "NULL",
    },
    {
      label: "user active-org pointer re-pointed",
      actual: single(`SELECT last_active_organization_id AS value FROM "user" WHERE id = 'u1'`),
      expected: "orgA",
    },
    {
      label: "pending invitations on dupes removed",
      actual: single(`SELECT count(*)::text AS value FROM invitation`),
      expected: "0",
    },
    {
      label: "org API key re-pointed, user key untouched",
      actual: single(`SELECT string_agg(reference_id, ',' ORDER BY id) AS value FROM apikey`),
      expected: "orgA,u1",
    },
    {
      label: "onboarding code re-pointed to keeper org and team",
      actual: single(
        `SELECT organization_id || '|' || team_id AS value FROM onboarding_code WHERE id = 'oc1'`,
      ),
      expected: "orgA|T2",
    },
    {
      label: "projects re-pointed to keeper",
      actual: (async () => {
        const result = await projectsClient.query<{ organization_id: string }>(
          `SELECT organization_id FROM projects WHERE id = 'p1'`,
        );
        return result.rows[0].organization_id;
      })(),
      expected: "orgA",
    },
    {
      label: "unrelated projects untouched",
      actual: (async () => {
        const result = await projectsClient.query<{ value: string }>(
          `SELECT string_agg(slug || '=' || organization_id, ',' ORDER BY slug) AS value FROM projects WHERE id IN ('p2','p3')`,
        );
        return result.rows[0].value;
      })(),
      expected: "proj-three=orgD,proj-two=orgA",
    },
  ];

  let failures = 0;
  for (const check of checks) {
    const actual = await check.actual;
    if (actual === check.expected) {
      console.log(`  PASS ${check.label}`);
    } else {
      failures += 1;
      console.log(
        `  FAIL ${check.label}\n       expected ${check.expected}\n       actual   ${actual}`,
      );
    }
  }

  console.log("\nself-test: idempotency (second run finds nothing)");
  const second = await loadPersonalGroups(authClient);
  if (second.groups.length === 0) {
    console.log("  PASS no groups remain after apply");
  } else {
    failures += 1;
    console.log(`  FAIL ${second.groups.length} group(s) still reported after apply`);
  }

  await authClient.end();
  await projectsClient.end();

  if (failures > 0) {
    throw new Error(`self-test failed: ${failures} check(s)`);
  }
  console.log("\nself-test PASSED");
}

async function main(): Promise<void> {
  if (SELF_TEST) {
    await selfTest();
    return;
  }

  if (!APPLY) {
    console.log("DRY RUN — no changes will be made. Re-run with --apply to execute.\n");
  }

  const auth = await openDatabase("AUTH_DATABASE_URL", process.env.AUTH_DATABASE_URL?.trim());
  const projects = await openDatabase(
    "PROJECTS_DATABASE_URL",
    process.env.PROJECTS_DATABASE_URL?.trim(),
  );

  try {
    await runConsolidation(auth, projects, APPLY);
  } finally {
    await auth.end();
    await projects?.end();
  }
}

main().catch((error) => {
  console.error(
    `consolidate-personal-orgs failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
