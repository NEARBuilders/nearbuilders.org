import { ORPCError } from "@orpc/server";
import { and, asc, eq, gt, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DatabaseTag } from "../db/layer";
import { projectPrograms, projects } from "../db/schema";
import { isRecentlyClosed, type ProgramState, programState } from "./program-state";

export type ProgramType = "credits" | "grant" | "bounty" | "api-access" | "accelerator" | "hackathon";
export type ProgramStatus = "draft" | "listed" | "paused" | "archived";
export type ProgramTopicId = "smart-contracts" | "private-cloud" | "agentic-commerce";

export interface ProgramProject {
  id: string;
  kind: "project" | "idea" | "scope" | "result";
  slug: string;
  title: string;
  ownerId: string;
  logoUrl: string | null;
}

export interface Program {
  id: string;
  projectId: string;
  type: ProgramType;
  title: string;
  summary: string | null;
  rewards: string | null;
  eligibility: string | null;
  ctaLabel: string;
  ctaUrl: string;
  topicId: ProgramTopicId | null;
  opensAt: string | null;
  closesAt: string | null;
  sortOrder: number;
  state: ProgramState;
  project: ProgramProject;
}

export interface AdminProgram extends Program {
  status: ProgramStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramFields {
  type: ProgramType;
  title: string;
  summary?: string | null;
  rewards?: string | null;
  eligibility?: string | null;
  ctaLabel: string;
  ctaUrl: string;
  topicId?: ProgramTopicId | null;
  opensAt?: string | null;
  closesAt?: string | null;
  status?: ProgramStatus;
  sortOrder?: number;
}

type ProgramRow = typeof projectPrograms.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

function emptyToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapProgram(row: { program: ProgramRow; project: ProjectRow }, now: Date): Program {
  const { program, project } = row;
  return {
    id: program.id,
    projectId: program.projectId,
    type: program.type as ProgramType,
    title: program.title,
    summary: program.summary,
    rewards: program.rewards,
    eligibility: program.eligibility,
    ctaLabel: program.ctaLabel,
    ctaUrl: program.ctaUrl,
    topicId: (program.topicId as ProgramTopicId | null) ?? null,
    opensAt: toIso(program.opensAt),
    closesAt: toIso(program.closesAt),
    sortOrder: program.sortOrder,
    state: programState(program, now),
    project: {
      id: project.id,
      kind: project.kind as ProgramProject["kind"],
      slug: project.slug,
      title: project.title,
      ownerId: project.ownerId,
      logoUrl: project.logoUrl,
    },
  };
}

function mapAdminProgram(row: { program: ProgramRow; project: ProjectRow }, now: Date) {
  return {
    ...mapProgram(row, now),
    status: row.program.status as ProgramStatus,
    createdBy: row.program.createdBy,
    createdAt: row.program.createdAt.toISOString(),
    updatedAt: row.program.updatedAt.toISOString(),
  } satisfies AdminProgram;
}

function hasValidWindow(opensAt: Date | null, closesAt: Date | null) {
  return !(opensAt && closesAt && closesAt.getTime() <= opensAt.getTime());
}

const invalidWindow = () =>
  new ORPCError("BAD_REQUEST", { message: "closesAt must be after opensAt" });

function generateProgramId(): string {
  return `prog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const listableProject = and(
  eq(projects.kind, "project"),
  eq(projects.status, "active"),
  ne(projects.visibility, "private"),
);

export class ProgramService extends Context.Service<
  ProgramService,
  {
    listPrograms: (topicId?: ProgramTopicId, now?: Date) => Effect.Effect<Program[]>;
    getProjectPrograms: (projectId: string, now?: Date) => Effect.Effect<Program[]>;
    adminListPrograms: (projectId?: string) => Effect.Effect<AdminProgram[]>;
    createProgram: (
      input: ProgramFields & { projectId: string },
      createdBy: string,
    ) => Effect.Effect<AdminProgram, ORPCError<string, unknown>>;
    updateProgram: (
      id: string,
      input: Partial<ProgramFields>,
    ) => Effect.Effect<AdminProgram, ORPCError<string, unknown>>;
    reorderPrograms: (ids: readonly string[]) => Effect.Effect<number, ORPCError<string, unknown>>;
  }
>()("ProgramService") {}

export const ProgramServiceLive = Layer.effect(
  ProgramService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    const selectWithProject = () =>
      db
        .select({ program: projectPrograms, project: projects })
        .from(projectPrograms)
        .innerJoin(projects, eq(projectPrograms.projectId, projects.id));

    const loadAdminProgram = (id: string) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          selectWithProject().where(eq(projectPrograms.id, id)).limit(1),
        );
        const row = rows[0];
        if (!row) {
          return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Program not found" }));
        }
        return mapAdminProgram(row, new Date());
      });

    return {
      listPrograms: (topicId, now = new Date()) =>
        Effect.promise(async () => {
          const rows = await selectWithProject()
            .where(
              and(
                eq(projectPrograms.status, "listed"),
                listableProject,
                or(isNull(projectPrograms.opensAt), lte(projectPrograms.opensAt, now)),
                or(isNull(projectPrograms.closesAt), gt(projectPrograms.closesAt, now)),
                topicId ? eq(projectPrograms.topicId, topicId) : undefined,
              ),
            )
            .orderBy(asc(projectPrograms.sortOrder), asc(projectPrograms.createdAt));
          return rows.map((row) => mapProgram(row, now));
        }),

      getProjectPrograms: (projectId, now = new Date()) =>
        Effect.promise(async () => {
          const rows = await selectWithProject()
            .where(
              and(
                eq(projectPrograms.projectId, projectId),
                eq(projectPrograms.status, "listed"),
                listableProject,
              ),
            )
            .orderBy(asc(projectPrograms.sortOrder), asc(projectPrograms.createdAt));
          const programs = rows
            .filter(({ program }) => {
              const state = programState(program, now);
              return state === "open" || isRecentlyClosed(program, now);
            })
            .map((row) => mapProgram(row, now));
          return [
            ...programs.filter((program) => program.state === "open"),
            ...programs.filter((program) => program.state === "closed"),
          ];
        }),

      adminListPrograms: (projectId) =>
        Effect.promise(async () => {
          const now = new Date();
          const rows = await selectWithProject()
            .where(projectId ? eq(projectPrograms.projectId, projectId) : undefined)
            .orderBy(asc(projectPrograms.sortOrder), asc(projectPrograms.createdAt));
          return rows.map((row) => mapAdminProgram(row, now));
        }),

      createProgram: (input, createdBy) =>
        Effect.gen(function* () {
          const projectRows = yield* Effect.promise(() =>
            db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1),
          );
          const project = projectRows[0];
          if (!project) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Project not found" }));
          }
          if (project.kind !== "project") {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "Programs can only belong to projects" }),
            );
          }
          const opensAt = toDate(input.opensAt) ?? null;
          const closesAt = toDate(input.closesAt) ?? null;
          if (!hasValidWindow(opensAt, closesAt)) return yield* Effect.fail(invalidWindow());
          const id = generateProgramId();
          yield* Effect.promise(() =>
            db.insert(projectPrograms).values({
              id,
              projectId: project.id,
              type: input.type,
              title: input.title.trim(),
              summary: emptyToNull(input.summary) ?? null,
              rewards: emptyToNull(input.rewards) ?? null,
              eligibility: emptyToNull(input.eligibility) ?? null,
              ctaLabel: input.ctaLabel.trim(),
              ctaUrl: input.ctaUrl.trim(),
              topicId: input.topicId ?? null,
              opensAt,
              closesAt,
              status: input.status ?? "draft",
              sortOrder: input.sortOrder ?? 0,
              createdBy,
            }),
          );
          return yield* loadAdminProgram(id);
        }),

      updateProgram: (id, input) =>
        Effect.gen(function* () {
          const existingRows = yield* Effect.promise(() =>
            db.select().from(projectPrograms).where(eq(projectPrograms.id, id)).limit(1),
          );
          const existing = existingRows[0];
          if (!existing) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Program not found" }));
          }
          const opensAt = toDate(input.opensAt);
          const closesAt = toDate(input.closesAt);
          if (
            !hasValidWindow(
              opensAt === undefined ? existing.opensAt : opensAt,
              closesAt === undefined ? existing.closesAt : closesAt,
            )
          ) {
            return yield* Effect.fail(invalidWindow());
          }
          const patch: Partial<typeof projectPrograms.$inferInsert> = {};
          if (input.type !== undefined) patch.type = input.type;
          if (input.title !== undefined) patch.title = input.title.trim();
          if (input.summary !== undefined) patch.summary = emptyToNull(input.summary) ?? null;
          if (input.rewards !== undefined) patch.rewards = emptyToNull(input.rewards) ?? null;
          if (input.eligibility !== undefined) {
            patch.eligibility = emptyToNull(input.eligibility) ?? null;
          }
          if (input.ctaLabel !== undefined) patch.ctaLabel = input.ctaLabel.trim();
          if (input.ctaUrl !== undefined) patch.ctaUrl = input.ctaUrl.trim();
          if (input.topicId !== undefined) patch.topicId = input.topicId;
          if (opensAt !== undefined) patch.opensAt = opensAt;
          if (closesAt !== undefined) patch.closesAt = closesAt;
          if (input.status !== undefined) patch.status = input.status;
          if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
          if (Object.keys(patch).length > 0) {
            yield* Effect.promise(() =>
              db
                .update(projectPrograms)
                .set({ ...patch, updatedAt: new Date() })
                .where(eq(projectPrograms.id, id)),
            );
          }
          return yield* loadAdminProgram(id);
        }),

      reorderPrograms: (ids) =>
        Effect.gen(function* () {
          const unique = [...new Set(ids)];
          if (unique.length !== ids.length) {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "Program ids must be unique" }),
            );
          }
          const found = yield* Effect.promise(() =>
            db
              .select({ id: projectPrograms.id })
              .from(projectPrograms)
              .where(inArray(projectPrograms.id, unique)),
          );
          if (found.length !== unique.length) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Program not found" }));
          }
          yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              for (const [index, id] of unique.entries()) {
                await tx
                  .update(projectPrograms)
                  .set({ sortOrder: index, updatedAt: new Date() })
                  .where(eq(projectPrograms.id, id));
              }
            }),
          );
          return unique.length;
        }),
    };
  }),
);
