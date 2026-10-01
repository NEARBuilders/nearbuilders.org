import { and, count, desc, eq, ilike, inArray, lte, notInArray, or, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import {
  proposalAuditLog,
  proposalEvaluations,
  proposalSubmissions,
  proposals,
  reviewLeases,
  telegramLinkCodes,
  telegramReviewers,
} from "../db/schema";

type ReviewStatus = "pending" | "approved" | "rejected" | "removed";
type ApplyStatus = "not_started" | "applying" | "applied" | "failed";
type RemoveStatus = "not_started" | "removing" | "removed" | "failed";
type ResubmissionPolicy = "rejected-only" | "rejected-or-removed";
const SYSTEM_ACTOR = "system";
const SYSTEM_ACTOR_LABEL = "System";
const LIFECYCLE_TIMEOUT_MS = 5 * 60 * 1000;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function nextTimestamp(previous?: Date | string | null): Date {
  const previousTime = previous ? new Date(previous).getTime() : 0;
  return new Date(Math.max(Date.now(), previousTime + 1));
}

export function sameVersion(updatedAt: Date) {
  return sql`date_trunc('milliseconds', ${proposals.updatedAt}) = ${updatedAt}`;
}

function lifecycleTimedOut(updatedAt: Date | string): boolean {
  return Date.now() - new Date(updatedAt).getTime() >= LIFECYCLE_TIMEOUT_MS;
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

function staleProposal() {
  return new ORPCError("BAD_REQUEST", {
    message: "This proposal changed. Refresh and try again.",
    data: { reason: "STALE_PROPOSAL" },
  });
}

function resubmissionError(reviewStatus: ReviewStatus, removeStatus: RemoveStatus) {
  if (reviewStatus === "removed" || removeStatus === "removed") {
    return "Removed proposals cannot be resubmitted";
  }
  if (reviewStatus === "pending") return "This proposal is already pending";
  if (reviewStatus === "approved") return "This proposal is already approved";
  return "This proposal cannot be resubmitted";
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
      resubmissionPolicy?: ResubmissionPolicy;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    approve: (input: {
      pluginId: string;
      entityId: string;
      expectedUpdatedAt: string;
      actorId: string;
      actor?: { name?: string; email?: string };
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    reject: (input: {
      pluginId: string;
      entityId: string;
      expectedUpdatedAt: string;
      reason?: string;
      actorId: string;
      actor?: { name?: string; email?: string };
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    withdraw: (input: {
      pluginId: string;
      entityId: string;
      expectedUpdatedAt: string;
      actorId: string;
      actor?: { name?: string; email?: string };
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    reopen: (input: {
      pluginId: string;
      entityId: string;
      expectedUpdatedAt: string;
      actorId: string;
      actor?: { name?: string; email?: string };
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    remove: (input: {
      pluginId: string;
      entityId: string;
      expectedUpdatedAt: string;
      actorId: string;
      actor?: { name?: string; email?: string };
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    markApplied: (input: {
      pluginId: string;
      entityId: string;
      expectedUpdatedAt: string;
      appliedResourceId?: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    markApplyFailed: (input: {
      pluginId: string;
      entityId: string;
      expectedUpdatedAt: string;
      error: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    markRemoved: (input: {
      pluginId: string;
      entityId: string;
      expectedUpdatedAt: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    markRemoveFailed: (input: {
      pluginId: string;
      entityId: string;
      expectedUpdatedAt: string;
      error: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getProposals: (input: {
      pluginId?: string;
      entityId?: string;
      reviewStatus?: ReviewStatus;
      lifecycleStatus?: "actionable";
      query?: string;
      limit?: number;
      cursor?: string;
      privatePluginIds?: string[];
      viewerId?: string;
      isAdmin?: boolean;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getProposalCount: (input: {
      pluginId: string;
      entityId: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getAuditLog: (input: {
      pluginId: string;
      entityId: string;
      limit?: number;
      cursor?: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getSubmissions: (input: {
      pluginId: string;
      entityId: string;
      limit?: number;
      cursor?: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getMySubmission: (input: {
      pluginId: string;
      entityId: string;
      submittedBy: string[];
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getReviewHistory: (input: {
      pluginId?: string;
      limit?: number;
      cursor?: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    recordEvaluation: (input: {
      pluginId: string;
      entityId: string;
      submissionCount: number;
      verdict: "ready" | "review" | "spam";
      score: number | null;
      summary: string;
      flags: string[];
      checks: unknown[];
      model: string | null;
      source?: string | null;
      promptVersion: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    acquireReviewLease: (input: {
      name: string;
      holder: string;
      ttlMs: number;
    }) => Effect.Effect<{ acquired: boolean }, ORPCError<string, unknown>>;
    getEvaluations: (input: {
      proposalIds: string[];
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getProposalById: (input: { id: string }) => Effect.Effect<any, ORPCError<string, unknown>>;
    createTelegramLinkCode: (input: {
      codeHash: string;
      telegramId: number;
      telegramUsername: string | null;
      telegramName: string | null;
      ttlMs: number;
    }) => Effect.Effect<{ expiresAt: string }, ORPCError<string, unknown>>;
    getTelegramLinkCode: (input: {
      codeHash: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    linkTelegramReviewer: (input: {
      codeHash: string;
      userId: string;
      userLabel: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getTelegramReviewer: (input: {
      telegramId: number;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    getTelegramReviewerByUser: (input: {
      userId: string;
    }) => Effect.Effect<any, ORPCError<string, unknown>>;
    listTelegramReviewers: () => Effect.Effect<any, ORPCError<string, unknown>>;
    removeTelegramReviewer: (input: {
      telegramId: number;
    }) => Effect.Effect<{ removed: boolean }, ORPCError<string, unknown>>;
  }
>() {}

function telegramReviewerRecord(row: any) {
  return {
    telegramId: Number(row.telegramId),
    telegramUsername: row.telegramUsername ?? null,
    telegramName: row.telegramName ?? null,
    userId: row.userId,
    userLabel: row.userLabel,
    linkedAt: toIsoString(row.linkedAt)!,
  };
}

function evaluationRecord(row: any) {
  return {
    id: row.id,
    proposalId: row.proposalId,
    pluginId: row.pluginId,
    entityId: row.entityId,
    submissionCount: row.submissionCount,
    verdict: row.verdict,
    score: row.score ?? null,
    summary: row.summary,
    flags: (parseJson(row.flags) as string[] | null) ?? [],
    checks: (parseJson(row.checks) as unknown[] | null) ?? [],
    model: row.model ?? null,
    source: row.source ?? null,
    promptVersion: row.promptVersion,
    evaluatedAt: toIsoString(row.evaluatedAt)!,
  };
}

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
                .select({
                  proposalId: proposalSubmissions.proposalId,
                  entityId: proposalSubmissions.entityId,
                  submittedBy: proposalSubmissions.submittedBy,
                })
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
              if (
                existingSubmission.entityId !== input.entityId ||
                existingSubmission.submittedBy !== input.actorId
              ) {
                return yield* Effect.fail(
                  new ORPCError("BAD_REQUEST", {
                    message: "Idempotency key was already used for another submission",
                  }),
                );
              }
              const existingProposal = yield* Effect.promise(() =>
                loadProposal(db, input.pluginId, input.entityId),
              );
              if (existingProposal) return existingProposal;
            }
          }

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
          const now = nextTimestamp(existing?.updatedAt);

          if (
            existing &&
            (existing.applyStatus === "applying" || existing.removeStatus === "removing")
          ) {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", {
                message: "A lifecycle action is already in progress",
              }),
            );
          }

          if (
            existing &&
            input.resubmissionPolicy === "rejected-only" &&
            existing.reviewStatus !== "rejected"
          ) {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", {
                message: resubmissionError(
                  existing.reviewStatus as ReviewStatus,
                  (existing.removeStatus as RemoveStatus) ?? "not_started",
                ),
              }),
            );
          }

          if (
            existing &&
            input.resubmissionPolicy === "rejected-or-removed" &&
            existing.reviewStatus !== "rejected" &&
            existing.reviewStatus !== "removed" &&
            existing.removeStatus !== "removed"
          ) {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", {
                message: resubmissionError(
                  existing.reviewStatus as ReviewStatus,
                  (existing.removeStatus as RemoveStatus) ?? "not_started",
                ),
              }),
            );
          }

          const saved = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              if (!existing) {
                await tx.insert(proposals).values({
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
                });
              } else {
                const updated = await tx
                  .update(proposals)
                  .set({
                    payload: serialize(input.payload),
                    reviewStatus: "pending",
                    applyStatus: "not_started",
                    removeStatus: "not_started",
                    rejectionReason: null,
                    applyError: null,
                    removeError: null,
                    appliedResourceId: null,
                    appliedAt: null,
                    removedAt: null,
                    updatedAt: now,
                  })
                  .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                  .returning({ id: proposals.id });
                if (!updated[0]) return false;
              }

              await tx.insert(proposalSubmissions).values({
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
              });

              await appendAudit(
                tx,
                proposalId,
                input.pluginId,
                input.entityId,
                "proposed",
                input.actorId,
                actorLabel(input.actor, input.source),
                { source: input.source ?? null, metadata: input.metadata ?? null },
              );
              return true;
            }),
          );

          if (!saved) return yield* Effect.fail(staleProposal());

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

          if (toIsoString(existing.updatedAt) !== input.expectedUpdatedAt) {
            return yield* Effect.fail(staleProposal());
          }

          if (existing.reviewStatus === "removed") {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "Removed proposals cannot be approved" }),
            );
          }

          if (existing.applyStatus === "applied") {
            return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
          }

          const retrying =
            existing.reviewStatus === "approved" &&
            (existing.applyStatus === "failed" ||
              (existing.applyStatus === "applying" && lifecycleTimedOut(existing.updatedAt)));
          if (existing.reviewStatus !== "pending" && !retrying) {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "Only pending proposals can be approved" }),
            );
          }

          const now = nextTimestamp(existing.updatedAt);
          const updated = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const rows = await tx
                .update(proposals)
                .set({
                  reviewStatus: "approved",
                  applyStatus: "applying",
                  rejectionReason: null,
                  applyError: null,
                  updatedAt: now,
                })
                .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                .returning({ id: proposals.id });
              if (!rows[0]) return false;
              await appendAudit(
                tx,
                existing.id,
                input.pluginId,
                input.entityId,
                retrying ? "apply_retried" : "approved",
                input.actorId,
                actorLabel(input.actor),
              );
              return true;
            }),
          );

          if (!updated) return yield* Effect.fail(staleProposal());

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

          if (toIsoString(existing.updatedAt) !== input.expectedUpdatedAt) {
            return yield* Effect.fail(staleProposal());
          }

          if (existing.reviewStatus !== "pending" || existing.applyStatus === "applying") {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "Only pending proposals can be rejected" }),
            );
          }

          const now = nextTimestamp(existing.updatedAt);
          const reason = input.reason?.trim() || null;
          const updated = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const rows = await tx
                .update(proposals)
                .set({
                  reviewStatus: "rejected",
                  applyStatus: "not_started",
                  rejectionReason: reason,
                  applyError: null,
                  updatedAt: now,
                })
                .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                .returning({ id: proposals.id });
              if (!rows[0]) return false;
              await appendAudit(
                tx,
                existing.id,
                input.pluginId,
                input.entityId,
                "rejected",
                input.actorId,
                actorLabel(input.actor),
                { reason },
              );
              return true;
            }),
          );

          if (!updated) return yield* Effect.fail(staleProposal());

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      withdraw: (input) =>
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

          if (toIsoString(existing.updatedAt) !== input.expectedUpdatedAt) {
            return yield* Effect.fail(staleProposal());
          }

          // Idempotent: a proposal that is already withdrawn is a no-op.
          if (existing.reviewStatus === "removed") {
            return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
          }

          if (existing.reviewStatus !== "pending" || existing.applyStatus === "applying") {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", {
                message: "Only a pending nomination can be withdrawn",
              }),
            );
          }

          const now = nextTimestamp(existing.updatedAt);
          const updated = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const rows = await tx
                .update(proposals)
                .set({
                  reviewStatus: "removed",
                  applyStatus: "not_started",
                  applyError: null,
                  updatedAt: now,
                })
                .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                .returning({ id: proposals.id });
              if (!rows[0]) return false;
              await appendAudit(
                tx,
                existing.id,
                input.pluginId,
                input.entityId,
                "withdrawn",
                input.actorId,
                actorLabel(input.actor),
              );
              return true;
            }),
          );

          if (!updated) return yield* Effect.fail(staleProposal());

          return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
        }),

      reopen: (input) =>
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

          if (toIsoString(existing.updatedAt) !== input.expectedUpdatedAt) {
            return yield* Effect.fail(staleProposal());
          }

          if (existing.reviewStatus !== "rejected") {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", {
                message: "Only rejected proposals can be reopened",
              }),
            );
          }

          const now = nextTimestamp(existing.updatedAt);
          const updated = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const rows = await tx
                .update(proposals)
                .set({
                  reviewStatus: "pending",
                  rejectionReason: null,
                  applyError: null,
                  updatedAt: now,
                })
                .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                .returning({ id: proposals.id });
              if (!rows[0]) return false;
              await appendAudit(
                tx,
                existing.id,
                input.pluginId,
                input.entityId,
                "reopened",
                input.actorId,
                actorLabel(input.actor),
              );
              return true;
            }),
          );

          if (!updated) return yield* Effect.fail(staleProposal());

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

          if (toIsoString(existing.updatedAt) !== input.expectedUpdatedAt) {
            return yield* Effect.fail(staleProposal());
          }

          if (existing.reviewStatus === "removed" && existing.removeStatus === "removed") {
            return yield* Effect.promise(() => loadProposal(db, input.pluginId, input.entityId));
          }

          const retrying =
            existing.removeStatus === "failed" ||
            (existing.removeStatus === "removing" && lifecycleTimedOut(existing.updatedAt));
          if (
            existing.reviewStatus !== "approved" ||
            existing.applyStatus !== "applied" ||
            (existing.removeStatus !== "not_started" && !retrying)
          ) {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", {
                message: "Only applied proposals can have approval revoked",
              }),
            );
          }

          const now = nextTimestamp(existing.updatedAt);
          const updated = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const rows = await tx
                .update(proposals)
                .set({ removeStatus: "removing", removeError: null, updatedAt: now })
                .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                .returning({ id: proposals.id });
              if (!rows[0]) return false;
              await appendAudit(
                tx,
                existing.id,
                input.pluginId,
                input.entityId,
                retrying ? "removal_retried" : "approval_revocation_started",
                input.actorId,
                actorLabel(input.actor),
              );
              return true;
            }),
          );

          if (!updated) return yield* Effect.fail(staleProposal());

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

          if (
            toIsoString(existing.updatedAt) !== input.expectedUpdatedAt ||
            existing.applyStatus !== "applying"
          ) {
            return yield* Effect.fail(staleProposal());
          }

          const now = nextTimestamp(existing.updatedAt);
          const updated = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const rows = await tx
                .update(proposals)
                .set({
                  applyStatus: "applied",
                  applyError: null,
                  appliedResourceId: input.appliedResourceId ?? existing.appliedResourceId,
                  appliedAt: now,
                  updatedAt: now,
                })
                .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                .returning({ id: proposals.id });
              if (!rows[0]) return false;
              await appendAudit(
                tx,
                existing.id,
                input.pluginId,
                input.entityId,
                "applied",
                SYSTEM_ACTOR,
                SYSTEM_ACTOR_LABEL,
                {
                  appliedResourceId: input.appliedResourceId ?? existing.appliedResourceId ?? null,
                },
              );
              return true;
            }),
          );

          if (!updated) return yield* Effect.fail(staleProposal());

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

          if (
            toIsoString(existing.updatedAt) !== input.expectedUpdatedAt ||
            existing.applyStatus !== "applying"
          ) {
            return yield* Effect.fail(staleProposal());
          }

          const now = nextTimestamp(existing.updatedAt);
          const updated = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const rows = await tx
                .update(proposals)
                .set({
                  applyStatus: "failed",
                  applyError: input.error,
                  updatedAt: now,
                })
                .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                .returning({ id: proposals.id });
              if (!rows[0]) return false;
              await appendAudit(
                tx,
                existing.id,
                input.pluginId,
                input.entityId,
                "apply_failed",
                SYSTEM_ACTOR,
                SYSTEM_ACTOR_LABEL,
                { error: input.error },
              );
              return true;
            }),
          );

          if (!updated) return yield* Effect.fail(staleProposal());

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

          if (
            toIsoString(existing.updatedAt) !== input.expectedUpdatedAt ||
            existing.removeStatus !== "removing"
          ) {
            return yield* Effect.fail(staleProposal());
          }

          const now = nextTimestamp(existing.updatedAt);
          const updated = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const rows = await tx
                .update(proposals)
                .set({
                  reviewStatus: "removed",
                  removeStatus: "removed",
                  removeError: null,
                  removedAt: now,
                  updatedAt: now,
                })
                .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                .returning({ id: proposals.id });
              if (!rows[0]) return false;
              await appendAudit(
                tx,
                existing.id,
                input.pluginId,
                input.entityId,
                "approval_revoked",
                SYSTEM_ACTOR,
                SYSTEM_ACTOR_LABEL,
              );
              return true;
            }),
          );

          if (!updated) return yield* Effect.fail(staleProposal());

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

          if (
            toIsoString(existing.updatedAt) !== input.expectedUpdatedAt ||
            existing.removeStatus !== "removing"
          ) {
            return yield* Effect.fail(staleProposal());
          }

          const now = nextTimestamp(existing.updatedAt);
          const updated = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const rows = await tx
                .update(proposals)
                .set({
                  removeStatus: "failed",
                  removeError: input.error,
                  updatedAt: now,
                })
                .where(and(eq(proposals.id, existing.id), sameVersion(existing.updatedAt)))
                .returning({ id: proposals.id });
              if (!rows[0]) return false;
              await appendAudit(
                tx,
                existing.id,
                input.pluginId,
                input.entityId,
                "remove_failed",
                SYSTEM_ACTOR,
                SYSTEM_ACTOR_LABEL,
                { error: input.error },
              );
              return true;
            }),
          );

          if (!updated) return yield* Effect.fail(staleProposal());

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
          if (input.lifecycleStatus === "actionable") {
            const lifecycleCutoff = new Date(Date.now() - LIFECYCLE_TIMEOUT_MS);
            conditions.push(
              or(
                eq(proposals.reviewStatus, "pending"),
                eq(proposals.applyStatus, "failed"),
                eq(proposals.removeStatus, "failed"),
                and(
                  eq(proposals.applyStatus, "applying"),
                  lte(proposals.updatedAt, lifecycleCutoff),
                ),
                and(
                  eq(proposals.removeStatus, "removing"),
                  lte(proposals.updatedAt, lifecycleCutoff),
                ),
              ),
            );
          }
          if (input.query) {
            const pattern = `%${input.query.trim()}%`;
            conditions.push(
              or(
                ilike(proposals.entityId, pattern),
                ilike(proposals.createdBy, pattern),
                ilike(proposals.payload, pattern),
              ),
            );
          }
          const privatePluginIds = input.privatePluginIds ?? [];
          if (!input.isAdmin && privatePluginIds.length > 0) {
            const publicProposal = notInArray(proposals.pluginId, privatePluginIds);
            conditions.push(
              input.viewerId
                ? or(
                    publicProposal,
                    and(
                      inArray(proposals.pluginId, privatePluginIds),
                      eq(proposals.createdBy, input.viewerId),
                    ),
                  )
                : publicProposal,
            );
          }

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
          const limit = Math.min(input.limit ?? 50, 100);
          const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
          const whereClause = and(
            eq(proposalAuditLog.pluginId, input.pluginId),
            eq(proposalAuditLog.entityId, input.entityId),
          );
          const [counted, rows] = yield* Effect.promise(() =>
            Promise.all([
              db.select({ count: count() }).from(proposalAuditLog).where(whereClause),
              db
                .select()
                .from(proposalAuditLog)
                .where(whereClause)
                .orderBy(desc(proposalAuditLog.createdAt), desc(proposalAuditLog.id))
                .limit(limit)
                .offset(offset),
            ]),
          );
          const total = counted[0]?.count ?? 0;
          const nextOffset = offset + limit;
          const hasMore = nextOffset < total;

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
            meta: {
              total,
              hasMore,
              nextCursor: hasMore ? String(nextOffset) : null,
            },
          };
        }),

      getSubmissions: (input) =>
        Effect.gen(function* () {
          const limit = Math.min(input.limit ?? 50, 100);
          const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
          const whereClause = and(
            eq(proposalSubmissions.pluginId, input.pluginId),
            eq(proposalSubmissions.entityId, input.entityId),
          );
          const [counted, rows] = yield* Effect.promise(() =>
            Promise.all([
              db.select({ count: count() }).from(proposalSubmissions).where(whereClause),
              db
                .select()
                .from(proposalSubmissions)
                .where(whereClause)
                .orderBy(desc(proposalSubmissions.createdAt), desc(proposalSubmissions.id))
                .limit(limit)
                .offset(offset),
            ]),
          );
          const total = counted[0]?.count ?? 0;
          const nextOffset = offset + limit;
          const hasMore = nextOffset < total;

          return {
            data: rows.map((row: any) => ({
              id: row.id,
              pluginId: row.pluginId,
              entityId: row.entityId,
              submittedBy: row.submittedBy,
              source: row.source ?? null,
              payload: parseJson(row.payload),
              metadata: parseJson(row.metadata),
              createdAt: toIsoString(row.createdAt)!,
            })),
            meta: {
              total,
              hasMore,
              nextCursor: hasMore ? String(nextOffset) : null,
            },
          };
        }),

      getMySubmission: (input) =>
        Effect.gen(function* () {
          if (input.submittedBy.length === 0) return { hasSubmitted: false };
          const [submission] = yield* Effect.promise(() =>
            db
              .select({ id: proposalSubmissions.id })
              .from(proposalSubmissions)
              .where(
                and(
                  eq(proposalSubmissions.pluginId, input.pluginId),
                  eq(proposalSubmissions.entityId, input.entityId),
                  inArray(proposalSubmissions.submittedBy, input.submittedBy),
                ),
              )
              .limit(1),
          );
          return { hasSubmitted: Boolean(submission) };
        }),

      recordEvaluation: (input) =>
        Effect.gen(function* () {
          const [proposal] = yield* Effect.promise(() =>
            db
              .select({ id: proposals.id })
              .from(proposals)
              .where(
                and(eq(proposals.pluginId, input.pluginId), eq(proposals.entityId, input.entityId)),
              )
              .limit(1),
          );
          if (!proposal) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Proposal not found" }),
            );
          }
          const values = {
            id: generateId("eval"),
            proposalId: proposal.id,
            pluginId: input.pluginId,
            entityId: input.entityId,
            submissionCount: input.submissionCount,
            verdict: input.verdict,
            score: input.score,
            summary: input.summary,
            flags: JSON.stringify(input.flags),
            checks: JSON.stringify(input.checks),
            model: input.model,
            source: input.source ?? null,
            promptVersion: input.promptVersion,
            evaluatedAt: new Date(),
          };
          const [row] = yield* Effect.promise(() =>
            db
              .insert(proposalEvaluations)
              .values(values)
              .onConflictDoUpdate({
                target: [proposalEvaluations.proposalId, proposalEvaluations.submissionCount],
                set: {
                  verdict: values.verdict,
                  score: values.score,
                  summary: values.summary,
                  flags: values.flags,
                  checks: values.checks,
                  model: values.model,
                  source: values.source,
                  promptVersion: values.promptVersion,
                  evaluatedAt: values.evaluatedAt,
                },
              })
              .returning(),
          );
          return { data: evaluationRecord(row) };
        }),

      acquireReviewLease: (input) =>
        Effect.gen(function* () {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + input.ttlMs);
          const rows = yield* Effect.promise(() =>
            db
              .insert(reviewLeases)
              .values({ name: input.name, holder: input.holder, expiresAt })
              .onConflictDoUpdate({
                target: reviewLeases.name,
                set: { holder: input.holder, expiresAt },
                setWhere: sql`${reviewLeases.expiresAt} < ${now} or ${reviewLeases.holder} = ${input.holder}`,
              })
              .returning({ holder: reviewLeases.holder }),
          );
          return { acquired: rows[0]?.holder === input.holder };
        }),

      getEvaluations: (input) =>
        Effect.gen(function* () {
          if (input.proposalIds.length === 0) return { data: [] };
          const rows = yield* Effect.promise(() =>
            db
              .select()
              .from(proposalEvaluations)
              .where(inArray(proposalEvaluations.proposalId, input.proposalIds))
              .orderBy(desc(proposalEvaluations.submissionCount)),
          );
          const latest = new Map<string, any>();
          for (const row of rows) {
            if (!latest.has(row.proposalId)) latest.set(row.proposalId, row);
          }
          return { data: Array.from(latest.values()).map(evaluationRecord) };
        }),

      getProposalById: (input) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db
              .select({ pluginId: proposals.pluginId, entityId: proposals.entityId })
              .from(proposals)
              .where(eq(proposals.id, input.id))
              .limit(1),
          );
          if (!row) return { data: null };
          const proposal = yield* Effect.promise(() =>
            loadProposal(db, row.pluginId, row.entityId),
          );
          return { data: proposal };
        }),

      createTelegramLinkCode: (input) =>
        Effect.gen(function* () {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + input.ttlMs);
          yield* Effect.promise(() =>
            db
              .delete(telegramLinkCodes)
              .where(
                or(
                  lte(telegramLinkCodes.expiresAt, now),
                  eq(telegramLinkCodes.telegramId, input.telegramId),
                ),
              ),
          );
          yield* Effect.promise(() =>
            db.insert(telegramLinkCodes).values({
              codeHash: input.codeHash,
              telegramId: input.telegramId,
              telegramUsername: input.telegramUsername,
              telegramName: input.telegramName,
              expiresAt,
            }),
          );
          return { expiresAt: expiresAt.toISOString() };
        }),

      getTelegramLinkCode: (input) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db
              .select()
              .from(telegramLinkCodes)
              .where(eq(telegramLinkCodes.codeHash, input.codeHash))
              .limit(1),
          );
          if (!row || row.expiresAt.getTime() <= Date.now()) return { data: null };
          return {
            data: {
              telegramId: Number(row.telegramId),
              telegramUsername: row.telegramUsername ?? null,
              telegramName: row.telegramName ?? null,
              expiresAt: row.expiresAt.toISOString(),
            },
          };
        }),

      linkTelegramReviewer: (input) =>
        Effect.gen(function* () {
          const row = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const [code] = await tx
                .delete(telegramLinkCodes)
                .where(eq(telegramLinkCodes.codeHash, input.codeHash))
                .returning();
              if (!code || code.expiresAt.getTime() <= Date.now()) return null;
              await tx
                .delete(telegramReviewers)
                .where(
                  or(
                    eq(telegramReviewers.userId, input.userId),
                    eq(telegramReviewers.telegramId, code.telegramId),
                  ),
                );
              const [linked] = await tx
                .insert(telegramReviewers)
                .values({
                  telegramId: code.telegramId,
                  telegramUsername: code.telegramUsername,
                  telegramName: code.telegramName,
                  userId: input.userId,
                  userLabel: input.userLabel,
                  linkedAt: new Date(),
                })
                .returning();
              return linked;
            }),
          );
          if (!row) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", {
                message: "This link has expired. Send /link to Chief again.",
              }),
            );
          }
          return { data: telegramReviewerRecord(row) };
        }),

      getTelegramReviewer: (input) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db
              .select()
              .from(telegramReviewers)
              .where(eq(telegramReviewers.telegramId, input.telegramId))
              .limit(1),
          );
          return { data: row ? telegramReviewerRecord(row) : null };
        }),

      getTelegramReviewerByUser: (input) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db
              .select()
              .from(telegramReviewers)
              .where(eq(telegramReviewers.userId, input.userId))
              .limit(1),
          );
          return { data: row ? telegramReviewerRecord(row) : null };
        }),

      listTelegramReviewers: () =>
        Effect.gen(function* () {
          const rows = yield* Effect.promise(() =>
            db.select().from(telegramReviewers).orderBy(desc(telegramReviewers.linkedAt)),
          );
          return { data: rows.map(telegramReviewerRecord) };
        }),

      removeTelegramReviewer: (input) =>
        Effect.gen(function* () {
          const rows = yield* Effect.promise(() =>
            db
              .delete(telegramReviewers)
              .where(eq(telegramReviewers.telegramId, input.telegramId))
              .returning({ telegramId: telegramReviewers.telegramId }),
          );
          return { removed: rows.length > 0 };
        }),

      getReviewHistory: (input) =>
        Effect.gen(function* () {
          const pageLimit = Math.min(input.limit ?? 50, 100);
          const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
          const conditions = [inArray(proposalAuditLog.action, ["approved", "rejected"])];
          if (input.pluginId) conditions.push(eq(proposalAuditLog.pluginId, input.pluginId));
          const whereClause = and(...conditions);

          const [counted, rows] = yield* Effect.promise(() =>
            Promise.all([
              db.select({ count: count() }).from(proposalAuditLog).where(whereClause),
              db
                .select()
                .from(proposalAuditLog)
                .where(whereClause)
                .orderBy(desc(proposalAuditLog.createdAt))
                .limit(pageLimit)
                .offset(offset),
            ]),
          );
          const total = counted[0]?.count ?? 0;
          const entries = yield* Effect.promise(() =>
            Promise.all(
              rows.map(async (row: any) => ({
                id: row.id,
                pluginId: row.pluginId,
                entityId: row.entityId,
                action: row.action as "approved" | "rejected",
                actor: row.actor,
                actorLabel: row.actorLabel ?? null,
                details: parseJson(row.details),
                createdAt: toIsoString(row.createdAt)!,
                proposal: await loadProposal(db, row.pluginId, row.entityId),
              })),
            ),
          );
          const data = entries.filter((entry: any) => entry.proposal);
          const nextOffset = offset + pageLimit;
          const hasMore = nextOffset < total;

          return {
            data,
            meta: {
              total,
              hasMore,
              nextCursor: hasMore ? String(nextOffset) : null,
            },
          };
        }),
    };
  }),
);
