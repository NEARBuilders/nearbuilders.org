import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, inArray, lt, max, ne } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DatabaseTag } from "../db/layer";
import { projectStatusChecks, projectStatusResults, projects } from "../db/schema";
import { assertHostIsPublic, probeStatusCheck } from "./status-probe";
import { STATUS_SEEDS } from "./status-seeds";
import {
  applyFlapGuard,
  displayState,
  historyCutoff,
  STATUS_MAX_CHECKS_PER_PROJECT,
  STATUS_RUN_COOLDOWN_MS,
  type StatusCheckKind,
  type StatusCheckStatus,
  type StatusDisplayState,
  type StatusOutcome,
  type StatusReason,
  type StatusState,
} from "./status-state";
import { checkStatusUrl, StatusBlockedError } from "./status-url";

export interface StatusCheckProject {
  id: string;
  kind: "project" | "idea" | "scope" | "result";
  slug: string;
  title: string;
  ownerId: string;
  logoUrl: string | null;
}

export interface StatusCheckResult {
  state: StatusState;
  reason: StatusReason | null;
  httpStatus: number | null;
  latencyMs: number | null;
  pluginKeys: string[];
  checkedAt: string;
}

export interface AdminStatusCheck {
  id: string;
  projectId: string;
  label: string;
  url: string;
  kind: StatusCheckKind;
  status: StatusCheckStatus;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  currentState: StatusDisplayState;
  latest: StatusCheckResult | null;
  project: StatusCheckProject;
}

export interface StatusCheckFields {
  label: string;
  url: string;
  kind: StatusCheckKind;
  status?: StatusCheckStatus;
  sortOrder?: number;
}

export interface StatusRunSummary {
  checked: number;
  pruned: number;
}

export interface StatusSeedSummary {
  created: number;
  existing: number;
  missing: string[];
}

type CheckRow = typeof projectStatusChecks.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type ResultRow = typeof projectStatusResults.$inferSelect;

const RUN_JITTER_MS = 5_000;
const RUN_CONCURRENCY = 5;

function generateCheckId(): string {
  return `chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function mapResult(row: ResultRow): StatusCheckResult {
  return {
    state: row.state as StatusState,
    reason: (row.reason as StatusReason | null) ?? null,
    httpStatus: row.httpStatus,
    latencyMs: row.latencyMs,
    pluginKeys: row.pluginKeys ?? [],
    checkedAt: row.checkedAt.toISOString(),
  };
}

function mapCheck(
  row: { check: CheckRow; project: ProjectRow },
  latest: ResultRow | undefined,
  now: Date,
): AdminStatusCheck {
  const { check, project } = row;
  const status = check.status as StatusCheckStatus;
  return {
    id: check.id,
    projectId: check.projectId,
    label: check.label,
    url: check.url,
    kind: check.kind as StatusCheckKind,
    status,
    sortOrder: check.sortOrder,
    createdBy: check.createdBy,
    createdAt: check.createdAt.toISOString(),
    updatedAt: check.updatedAt.toISOString(),
    currentState: displayState(status, latest ?? null, now),
    latest: latest ? mapResult(latest) : null,
    project: {
      id: project.id,
      kind: project.kind as StatusCheckProject["kind"],
      slug: project.slug,
      title: project.title,
      ownerId: project.ownerId,
      logoUrl: project.logoUrl,
    },
  };
}

const listableProject = and(
  eq(projects.kind, "project"),
  eq(projects.status, "active"),
  ne(projects.visibility, "private"),
);

const badRequest = (message: string) => new ORPCError("BAD_REQUEST", { message });

export class StatusCheckService extends Context.Service<
  StatusCheckService,
  {
    adminListStatusChecks: (projectId?: string) => Effect.Effect<AdminStatusCheck[]>;
    createStatusCheck: (
      input: StatusCheckFields & { projectId: string },
      createdBy: string,
    ) => Effect.Effect<AdminStatusCheck, ORPCError<string, unknown>>;
    updateStatusCheck: (
      id: string,
      input: Partial<StatusCheckFields>,
    ) => Effect.Effect<AdminStatusCheck, ORPCError<string, unknown>>;
    deleteStatusCheck: (id: string) => Effect.Effect<{ id: string }, ORPCError<string, unknown>>;
    seedStatusChecks: (createdBy: string) => Effect.Effect<StatusSeedSummary>;
    runStatusCheck: (
      id: string,
      now?: Date,
    ) => Effect.Effect<AdminStatusCheck, ORPCError<string, unknown>>;
    runListedChecks: (now?: Date) => Effect.Effect<StatusRunSummary>;
    pruneHistory: (now?: Date) => Effect.Effect<number>;
  }
>()("StatusCheckService") {}

export const StatusCheckServiceLive = Layer.effect(
  StatusCheckService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    const selectWithProject = () =>
      db
        .select({ check: projectStatusChecks, project: projects })
        .from(projectStatusChecks)
        .innerJoin(projects, eq(projectStatusChecks.projectId, projects.id));

    const latestResults = async (checkIds: string[]) => {
      if (checkIds.length === 0) return new Map<string, ResultRow>();
      const rows = await db
        .selectDistinctOn([projectStatusResults.checkId])
        .from(projectStatusResults)
        .where(inArray(projectStatusResults.checkId, checkIds))
        .orderBy(projectStatusResults.checkId, desc(projectStatusResults.checkedAt));
      return new Map(rows.map((row) => [row.checkId, row]));
    };

    const loadCheck = (id: string) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          selectWithProject().where(eq(projectStatusChecks.id, id)).limit(1),
        );
        const row = rows[0];
        if (!row) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Status check not found" }),
          );
        }
        const latest = yield* Effect.promise(() => latestResults([id]));
        return mapCheck(row, latest.get(id), new Date());
      });

    const validateUrl = (value: string) =>
      Effect.gen(function* () {
        const checked = checkStatusUrl(value.trim());
        if (!checked.ok) return yield* Effect.fail(badRequest(checked.message));
        yield* Effect.tryPromise({
          try: () => assertHostIsPublic(checked.url.hostname),
          catch: (cause) =>
            cause instanceof StatusBlockedError
              ? badRequest("Status checks must point at a public host")
              : badRequest("Couldn't resolve the status check host"),
        });
        return checked.url.toString();
      });

    const assertListable = (projectId: string, url: string, excludeId?: string) =>
      Effect.gen(function* () {
        const listable = yield* Effect.promise(() =>
          db
            .select({ id: projects.id })
            .from(projects)
            .where(and(eq(projects.id, projectId), listableProject))
            .limit(1),
        );
        if (listable.length === 0) {
          return yield* Effect.fail(
            badRequest("Only active, non-private projects can have listed status checks"),
          );
        }
        const duplicates = yield* Effect.promise(() =>
          db
            .select({ id: projectStatusChecks.id })
            .from(projectStatusChecks)
            .where(
              and(
                eq(projectStatusChecks.url, url),
                eq(projectStatusChecks.status, "listed"),
                excludeId ? ne(projectStatusChecks.id, excludeId) : undefined,
              ),
            )
            .limit(1),
        );
        if (duplicates.length > 0) {
          return yield* Effect.fail(badRequest("Another listed status check uses this URL"));
        }
      });

    const assertCapacity = (projectId: string) =>
      Effect.gen(function* () {
        const [row] = yield* Effect.promise(() =>
          db
            .select({ value: count() })
            .from(projectStatusChecks)
            .where(
              and(
                eq(projectStatusChecks.projectId, projectId),
                ne(projectStatusChecks.status, "archived"),
              ),
            ),
        );
        if ((row?.value ?? 0) >= STATUS_MAX_CHECKS_PER_PROJECT) {
          return yield* Effect.fail(
            badRequest(`A project can have at most ${STATUS_MAX_CHECKS_PER_PROJECT} status checks`),
          );
        }
      });

    const nextSortOrder = () =>
      Effect.promise(async () => {
        const [row] = await db
          .select({ value: max(projectStatusChecks.sortOrder) })
          .from(projectStatusChecks);
        return row?.value === null || row?.value === undefined ? 0 : row.value + 1;
      });

    const recordOutcome = (checkId: string, outcome: StatusOutcome, checkedAt: Date) =>
      Effect.promise(async () => {
        const [previous] = await db
          .select({ reason: projectStatusResults.reason })
          .from(projectStatusResults)
          .where(eq(projectStatusResults.checkId, checkId))
          .orderBy(desc(projectStatusResults.checkedAt))
          .limit(1);
        const guarded = applyFlapGuard(outcome, previous?.reason);
        await db.insert(projectStatusResults).values({
          id: `res_${randomUUID()}`,
          checkId,
          checkedAt,
          state: guarded.state,
          httpStatus: guarded.httpStatus,
          latencyMs: guarded.latencyMs,
          reason: guarded.reason,
          pluginKeys: guarded.pluginKeys.length > 0 ? guarded.pluginKeys : null,
        });
      });

    const runOne = (check: Pick<CheckRow, "id" | "kind" | "url">) =>
      Effect.gen(function* () {
        const outcome = yield* Effect.promise(() =>
          probeStatusCheck(check.kind as StatusCheckKind, check.url),
        );
        yield* recordOutcome(check.id, outcome, new Date());
      });

    const pruneHistory = (now: Date = new Date()) =>
      Effect.promise(async () => {
        const removed = await db
          .delete(projectStatusResults)
          .where(lt(projectStatusResults.checkedAt, historyCutoff(now)))
          .returning({ id: projectStatusResults.id });
        return removed.length;
      });

    return {
      adminListStatusChecks: (projectId) =>
        Effect.promise(async () => {
          const now = new Date();
          const rows = await selectWithProject()
            .where(projectId ? eq(projectStatusChecks.projectId, projectId) : undefined)
            .orderBy(asc(projectStatusChecks.sortOrder), asc(projectStatusChecks.createdAt));
          const latest = await latestResults(rows.map((row) => row.check.id));
          return rows.map((row) => mapCheck(row, latest.get(row.check.id), now));
        }),

      createStatusCheck: (input, createdBy) =>
        Effect.gen(function* () {
          const projectRows = yield* Effect.promise(() =>
            db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1),
          );
          const project = projectRows[0];
          if (!project) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Project not found" }));
          }
          if (project.kind !== "project") {
            return yield* Effect.fail(badRequest("Status checks can only belong to projects"));
          }
          const url = yield* validateUrl(input.url);
          const status = input.status ?? "draft";
          if (status !== "archived") yield* assertCapacity(project.id);
          if (status === "listed") yield* assertListable(project.id, url);
          const sortOrder = input.sortOrder ?? (yield* nextSortOrder());
          const id = generateCheckId();
          yield* Effect.promise(() =>
            db.insert(projectStatusChecks).values({
              id,
              projectId: project.id,
              label: input.label.trim(),
              url,
              kind: input.kind,
              status,
              sortOrder,
              createdBy,
            }),
          );
          return yield* loadCheck(id);
        }),

      updateStatusCheck: (id, input) =>
        Effect.gen(function* () {
          const existingRows = yield* Effect.promise(() =>
            db.select().from(projectStatusChecks).where(eq(projectStatusChecks.id, id)).limit(1),
          );
          const existing = existingRows[0];
          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Status check not found" }),
            );
          }
          const url = input.url === undefined ? existing.url : yield* validateUrl(input.url);
          const status = input.status ?? (existing.status as StatusCheckStatus);
          if (existing.status === "archived" && status !== "archived") {
            yield* assertCapacity(existing.projectId);
          }
          if (status === "listed" && (existing.status !== "listed" || url !== existing.url)) {
            yield* assertListable(existing.projectId, url, id);
          }
          const patch: Partial<typeof projectStatusChecks.$inferInsert> = {};
          if (input.label !== undefined) patch.label = input.label.trim();
          if (input.url !== undefined) patch.url = url;
          if (input.kind !== undefined) patch.kind = input.kind;
          if (input.status !== undefined) patch.status = input.status;
          if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
          if (Object.keys(patch).length > 0) {
            yield* Effect.promise(() =>
              db
                .update(projectStatusChecks)
                .set({ ...patch, updatedAt: new Date() })
                .where(eq(projectStatusChecks.id, id)),
            );
          }
          return yield* loadCheck(id);
        }),

      deleteStatusCheck: (id) =>
        Effect.gen(function* () {
          const removed = yield* Effect.promise(() =>
            db
              .delete(projectStatusChecks)
              .where(eq(projectStatusChecks.id, id))
              .returning({ id: projectStatusChecks.id }),
          );
          if (removed.length === 0) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Status check not found" }),
            );
          }
          return { id };
        }),

      seedStatusChecks: (createdBy) =>
        Effect.promise(async () => {
          const slugs = STATUS_SEEDS.map((seed) => seed.projectSlug);
          const projectRows = await db
            .select({ id: projects.id, slug: projects.slug })
            .from(projects)
            .where(and(inArray(projects.slug, slugs), listableProject));
          const projectIds = new Map(projectRows.map((row) => [row.slug, row.id]));
          const existingRows = await db
            .select({ url: projectStatusChecks.url })
            .from(projectStatusChecks)
            .where(
              inArray(
                projectStatusChecks.url,
                STATUS_SEEDS.map((seed) => seed.url),
              ),
            );
          const existingUrls = new Set(existingRows.map((row) => row.url));
          const [orderRow] = await db
            .select({ value: max(projectStatusChecks.sortOrder) })
            .from(projectStatusChecks);
          let sortOrder =
            orderRow?.value === null || orderRow?.value === undefined ? 0 : orderRow.value + 1;
          const summary: StatusSeedSummary = { created: 0, existing: 0, missing: [] };
          for (const seed of STATUS_SEEDS) {
            const projectId = projectIds.get(seed.projectSlug);
            if (!projectId) {
              summary.missing.push(seed.projectSlug);
              continue;
            }
            if (existingUrls.has(seed.url)) {
              summary.existing += 1;
              continue;
            }
            await db.insert(projectStatusChecks).values({
              id: generateCheckId(),
              projectId,
              label: seed.label,
              url: seed.url,
              kind: "everything-dev-health",
              status: "listed",
              sortOrder,
              createdBy,
            });
            sortOrder += 1;
            summary.created += 1;
          }
          return summary;
        }),

      runStatusCheck: (id, now = new Date()) =>
        Effect.gen(function* () {
          const rows = yield* Effect.promise(() =>
            db.select().from(projectStatusChecks).where(eq(projectStatusChecks.id, id)).limit(1),
          );
          const check = rows[0];
          if (!check) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Status check not found" }),
            );
          }
          const latest = (yield* Effect.promise(() => latestResults([id]))).get(id);
          const elapsed = latest ? now.getTime() - latest.checkedAt.getTime() : Infinity;
          if (elapsed < STATUS_RUN_COOLDOWN_MS) {
            return yield* Effect.fail(
              new ORPCError("RATE_LIMITED", {
                message: "This check ran less than a minute ago",
                data: { retryAfter: Math.ceil((STATUS_RUN_COOLDOWN_MS - elapsed) / 1000) },
              }),
            );
          }
          yield* pruneHistory(now);
          yield* runOne(check);
          return yield* loadCheck(id);
        }),

      runListedChecks: (at) =>
        Effect.gen(function* () {
          const now = at ?? new Date();
          const checks = yield* Effect.promise(() =>
            db
              .select({
                id: projectStatusChecks.id,
                kind: projectStatusChecks.kind,
                url: projectStatusChecks.url,
              })
              .from(projectStatusChecks)
              .innerJoin(projects, eq(projectStatusChecks.projectId, projects.id))
              .where(and(eq(projectStatusChecks.status, "listed"), listableProject)),
          );
          const pruned = yield* pruneHistory(now);
          yield* Effect.forEach(
            checks,
            (check) =>
              Effect.sleep(Math.floor(Math.random() * RUN_JITTER_MS)).pipe(
                Effect.andThen(runOne(check)),
                Effect.catchCause((cause) =>
                  Effect.logError(`[Projects] Status check ${check.id} failed`, cause),
                ),
              ),
            { concurrency: RUN_CONCURRENCY, discard: true },
          );
          return { checked: checks.length, pruned };
        }),

      pruneHistory,
    };
  }),
);
