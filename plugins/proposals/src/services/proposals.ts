import { and, count, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { proposalAuditLog, proposalSubmissions, proposals } from "../db/schema";

type ReviewStatus = "pending" | "approved" | "rejected" | "removed";
type ApplyStatus = "not_started" | "applied" | "failed";
type RemoveStatus = "not_started" | "removed" | "failed";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function serialize(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function actorLabel(user?: { name?: string; email?: string }, source?: string): string | null {
  return source ?? user?.name ?? user?.email ?? null;
}

async function countSubmissions(db: any, proposalId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(proposalSubmissions)
    .where(eq(proposalSubmissions.proposalId, proposalId));

  return result?.count ?? 0;
}

async function loadProposal(db: any, pluginId: string, entityId: string) {
  const [row] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.pluginId, pluginId), eq(proposals.entityId, entityId)))
    .limit(1);

  if (!row) return null;
  const submissionCount = await countSubmissions(db, row.id);
  return {
    id: row.id,
    pluginId: row.pluginId,
    entityId: row.entityId,
    operation: row.operation as "create",
    payload: parseJson(row.payload),
    schemaVersion: row.schemaVersion,
    createdBy: row.createdBy,
    reviewStatus: row.reviewStatus as ReviewStatus,
    applyStatus: row.applyStatus as ApplyStatus,
    removeStatus: (row.removeStatus as RemoveStatus) ?? "not_started",
    rejectionReason: row.rejectionReason ?? null,
    applyError: row.applyError ?? null,
    removeError: (row.removeError as string) ?? null,
    appliedResourceId: row.appliedResourceId ?? null,
    submissionCount,
    appliedAt: toIsoString(row.appliedAt),
    removedAt: toIsoString(row.removedAt),
    createdAt: toIsoString(row.createdAt)!,
    updatedAt: toIsoString(row.updatedAt)!,
  };
}

async function appendAudit(
  db: any,
  proposalId: string,
  pluginId: string,
  entityId: string,
  action: string,
  actor: string,
  actorLabelValue?: string | null,
  details?: unknown,
) {
  await db.insert(proposalAuditLog).values({
    id: generateId("audit"),
    proposalId,
    pluginId,
    entityId,
    action,
    actor,
    actorLabel: actorLabelValue ?? null,
    details: details === undefined ? null : serialize(details),
    createdAt: new Date(),
  });
}

export class ProposalService extends Context.Tag("proposals/ProposalService")<
  ProposalService,
  {
    propose: (input: {
      pluginId: string;
      entityId: string;
      payload: unknown;
      source?: string;
      metadata?: unknown;
      idempotencyKey?: string;
      actorId: string;
      actor?: { name?: string; email?: string };
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    approve: (input: {
      pluginId: string;
      entityId: string;
      actorId: string;
      actor?: { name?: string; email?: string };
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    reject: (input: {
      pluginId: string;
      entityId: string;
      reason?: string;
      actorId: string;
      actor?: { name?: string; email?: string };
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    remove: (input: {
      pluginId: string;
      entityId: string;
      actorId: string;
      actor?: { name?: string; email?: string };
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    markApplied: (input: {
      pluginId: string;
      entityId: string;
      appliedResourceId?: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    markApplyFailed: (input: {
      pluginId: string;
      entityId: string;
      error: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    markRemoved: (input: {
      pluginId: string;
      entityId: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    markRemoveFailed: (input: {
      pluginId: string;
      entityId: string;
      error: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getProposals: (input: {
      pluginId?: string;
      entityId?: string;
      reviewStatus?: ReviewStatus;
      limit?: number;
      cursor?: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getProposalCount: (input: {
      pluginId: string;
      entityId: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getAuditLog: (input: {
      pluginId: string;
      entityId: string;
      limit?: number;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
  }
>() {}

export const ProposalServiceLive = Layer.effect(
  ProposalService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    return {
      propose: (input) =>
        Effect.gen(function* () {
          const idempotencyKey = input.idempotencyKey;

          if (idempotencyKey) {
            const [existingSubmission] = yield* Effect.promise(() =>
              db
                .select({ proposalId: proposalSubmissions.proposalId })
                .from(proposalSubmissions)
                .where(
                  and(
                    eq(proposalSubmissions.pluginId, input.pluginId),
                    eq(proposalSubmissions.idempotencyKey, idempotencyKey),
                  ),
                )
                .limit(1),
            );

            if (existingSubmission?.proposalId) {
              const existingProposal = yield* Effect.promise(() =>
                loadProposal(db, input.pluginId, input.entityId),
              );
              if (existingProposal) return existingProposal;
            }
          }

          const now = new Date();
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(proposals)
              .where(
                and(eq(proposals.pluginId, input.pluginId), eq(proposals.entityId, input.entityId)),
              )
              .limit(1),
          );

          const proposalId = existing?.id ?? generateId("prop");

          if (!existing) {
            yield* Effect.promise(() =>
              db.insert(proposals).values({
                id: proposalId,
                pluginId: input.pluginId,
                entityId: input.entityId,
                operation: "create",
                payload: serialize(input.payload),
                schemaVersion: "1",
                createdBy: input.actorId,
                reviewStatus: "pending",
                applyStatus: "not_started",
                removeStatus: "not_started",
                rejectionReason: null,
                applyError: null,
                removeError: null,
                appliedResourceId: null,
                appliedAt: null,
                removedAt: null,
                createdAt: now,
                updatedAt: now,
              }),
            );
          } else {
            if (existing.reviewStatus === "approved" || existing.applyStatus === "applied") {
              return yield* Effect.fail(
                new ORPCError("BAD_REQUEST", {
                  message: "Proposal already approved; submit a new proposal instead",
                }),
              );
            }

            const nextReviewStatus =
              existing.reviewStatus === "rejected" || existing.reviewStatus === "removed"
                ? "pending"
                : existing.reviewStatus;

            yield* Effect.promise(() =>
              db
                .update(proposals)
                .set({
                  payload: serialize(input.payload),
                  reviewStatus: nextReviewStatus,
                  applyStatus:
                    nextReviewStatus === "pending" ? "not_started" : existing.applyStatus,
                  rejectionReason: nextReviewStatus === "pending" ? null : existing.rejectionReason,
                  applyError: null,
                  updatedAt: now,
                })
                .where(eq(proposals.id, existing.id)),
            );
          }

          yield* Effect.promise(() =>
            db.insert(proposalSubmissions).values({
              id: generateId("sub"),
              proposalId,
              pluginId: input.pluginId,
              entityId: input.entityId,
              submittedBy: input.actorId,
              source: input.source ?? null,
              idempotencyKey: input.idempotencyKey ?? null,
              payload: serialize(input.payload),
              metadata: input.metadata === undefined ? null : serialize(input.metadata),
              createdAt: now,
            }),
          );

          yield* Effect.promise(() =>
            appendAudit(
              db,
              proposalId,
              input.pluginId,
              input.entityId,
              "proposed",
              input.actorId,
              actorLabel(input.actor, input.source),
              { source: input.source ?? null, metadata: input.metadata ?? null },
            ),
          );

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      approve: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(proposals)
              .where(
                and(eq(proposals.pluginId, input.pluginId), eq(proposals.entityId, input.entityId)),
              )
              .limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Proposal not found" }),
            );
          }

          if (existing.reviewStatus === "removed") {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "Removed proposals cannot be approved" }),
            );
          }

          if (existing.reviewStatus !== "approved") {
            const now = new Date();
            yield* Effect.promise(() =>
              db
                .update(proposals)
                .set({
                  reviewStatus: "approved",
                  rejectionReason: null,
                  applyError: null,
                  updatedAt: now,
                })
                .where(eq(proposals.id, existing.id)),
            );

            yield* Effect.promise(() =>
              appendAudit(
                db,
                existing.id,
                input.pluginId,
                input.entityId,
                "approved",
                input.actorId,
                actorLabel(input.actor),
              ),
            );
          }

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      reject: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(proposals)
              .where(
                and(eq(proposals.pluginId, input.pluginId), eq(proposals.entityId, input.entityId)),
              )
              .limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Proposal not found" }),
            );
          }

          if (existing.applyStatus === "applied") {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "Applied proposals cannot be rejected" }),
            );
          }

          const now = new Date();
          const reason = input.reason?.trim() || null;
          yield* Effect.promise(() =>
            db
              .update(proposals)
              .set({
                reviewStatus: "rejected",
                rejectionReason: reason,
                applyError: null,
                updatedAt: now,
              })
              .where(eq(proposals.id, existing.id)),
          );

          yield* Effect.promise(() =>
            appendAudit(
              db,
              existing.id,
              input.pluginId,
              input.entityId,
              "rejected",
              input.actorId,
              actorLabel(input.actor),
              { reason },
            ),
          );

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      remove: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(proposals)
              .where(
                and(eq(proposals.pluginId, input.pluginId), eq(proposals.entityId, input.entityId)),
              )
              .limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Proposal not found" }),
            );
          }

          if (existing.reviewStatus !== "removed") {
            const now = new Date();
            yield* Effect.promise(() =>
              db
                .update(proposals)
                .set({ reviewStatus: "removed", updatedAt: now })
                .where(eq(proposals.id, existing.id)),
            );

            yield* Effect.promise(() =>
              appendAudit(
                db,
                existing.id,
                input.pluginId,
                input.entityId,
                "removed",
                input.actorId,
                actorLabel(input.actor),
              ),
            );
          }

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      markApplied: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(proposals)
              .where(
                and(eq(proposals.pluginId, input.pluginId), eq(proposals.entityId, input.entityId)),
              )
              .limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Proposal not found" }),
            );
          }

          const now = new Date();
          yield* Effect.promise(() =>
            db
              .update(proposals)
              .set({
                applyStatus: "applied",
                applyError: null,
                appliedResourceId: input.appliedResourceId ?? existing.appliedResourceId,
                appliedAt: now,
                updatedAt: now,
              })
              .where(eq(proposals.id, existing.id)),
          );

          yield* Effect.promise(() =>
            appendAudit(
              db,
              existing.id,
              input.pluginId,
              input.entityId,
              "applied",
              existing.createdBy,
              null,
              { appliedResourceId: input.appliedResourceId ?? existing.appliedResourceId ?? null },
            ),
          );

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      markApplyFailed: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(proposals)
              .where(
                and(eq(proposals.pluginId, input.pluginId), eq(proposals.entityId, input.entityId)),
              )
              .limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Proposal not found" }),
            );
          }

          const now = new Date();
          yield* Effect.promise(() =>
            db
              .update(proposals)
              .set({
                applyStatus: "failed",
                applyError: input.error,
                updatedAt: now,
              })
              .where(eq(proposals.id, existing.id)),
          );

          yield* Effect.promise(() =>
            appendAudit(
              db,
              existing.id,
              input.pluginId,
              input.entityId,
              "apply_failed",
              existing.createdBy,
              null,
              { error: input.error },
            ),
          );

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      markRemoved: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(proposals)
              .where(
                and(eq(proposals.pluginId, input.pluginId), eq(proposals.entityId, input.entityId)),
              )
              .limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Proposal not found" }),
            );
          }

          const now = new Date();
          yield* Effect.promise(() =>
            db
              .update(proposals)
              .set({
                removeStatus: "removed",
                removeError: null,
                removedAt: now,
                updatedAt: now,
              })
              .where(eq(proposals.id, existing.id)),
          );

          yield* Effect.promise(() =>
            appendAudit(
              db,
              existing.id,
              input.pluginId,
              input.entityId,
              "removed",
              existing.createdBy,
              null,
            ),
          );

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      markRemoveFailed: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(proposals)
              .where(
                and(eq(proposals.pluginId, input.pluginId), eq(proposals.entityId, input.entityId)),
              )
              .limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Proposal not found" }),
            );
          }

          const now = new Date();
          yield* Effect.promise(() =>
            db
              .update(proposals)
              .set({
                removeStatus: "failed",
                removeError: input.error,
                updatedAt: now,
              })
              .where(eq(proposals.id, existing.id)),
          );

          yield* Effect.promise(() =>
            appendAudit(
              db,
              existing.id,
              input.pluginId,
              input.entityId,
              "remove_failed",
              existing.createdBy,
              null,
              { error: input.error },
            ),
          );

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      getProposals: (input) =>
        Effect.gen(function* () {
          const pageLimit = Math.min(input.limit ?? 50, 100);
          const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;

          const conditions = [] as any[];
          if (input.pluginId) conditions.push(eq(proposals.pluginId, input.pluginId));
          if (input.entityId) conditions.push(eq(proposals.entityId, input.entityId));
          if (input.reviewStatus) conditions.push(eq(proposals.reviewStatus, input.reviewStatus));

          const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

          const counted = yield* Effect.promise(() => {
            const countQuery = db.select({ count: count() }).from(proposals);
            return whereClause ? countQuery.where(whereClause) : countQuery;
          });
          const total = counted[0]?.count ?? 0;

          const rows = yield* Effect.promise(() => {
            const baseQuery = db
              .select()
              .from(proposals)
              .orderBy(desc(proposals.updatedAt))
              .limit(pageLimit)
              .offset(offset);
            return whereClause ? baseQuery.where(whereClause) : baseQuery;
          });

          const data = yield* Effect.promise(() =>
            Promise.all(rows.map((row: any) => loadProposal(db, row.pluginId, row.entityId))),
          );
          const filtered = data.filter(Boolean);
          const nextOffset = offset + pageLimit;
          const hasMore = nextOffset < total;

          return {
            data: filtered,
            meta: {
              total,
              hasMore,
              nextCursor: hasMore ? String(nextOffset) : null,
            },
          };
        }),

      getProposalCount: (input) =>
        Effect.gen(function* () {
          const [result] = yield* Effect.promise(() =>
            db
              .select({ count: count() })
              .from(proposalSubmissions)
              .where(
                and(
                  eq(proposalSubmissions.pluginId, input.pluginId),
                  eq(proposalSubmissions.entityId, input.entityId),
                ),
              ),
          );

          return {
            pluginId: input.pluginId,
            entityId: input.entityId,
            totalCount: result?.count ?? 0,
          };
        }),

      getAuditLog: (input) =>
        Effect.gen(function* () {
          const limit = Math.min(input.limit ?? 100, 200);
          const rows = yield* Effect.promise(() =>
            db
              .select()
              .from(proposalAuditLog)
              .where(
                and(
                  eq(proposalAuditLog.pluginId, input.pluginId),
                  eq(proposalAuditLog.entityId, input.entityId),
                ),
              )
              .orderBy(desc(proposalAuditLog.createdAt))
              .limit(limit),
          );

          return {
            data: rows.map((row: any) => ({
              id: row.id,
              pluginId: row.pluginId,
              entityId: row.entityId,
              action: row.action,
              actor: row.actor,
              actorLabel: row.actorLabel ?? null,
              details: parseJson(row.details),
              createdAt: toIsoString(row.createdAt)!,
            })),
          };
        }),
    };
  }),
);
