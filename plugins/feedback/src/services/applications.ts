import { and, count, desc, eq, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type { FeedbackApplicationSchema, FeedbackApplicationStatus } from "../contract";
import { DatabaseTag } from "../db/layer";
import { feedbackApplications, feedbackRequests } from "../db/schema";

type FeedbackApplication = z.infer<typeof FeedbackApplicationSchema>;

export interface ListApplicationsFilters {
  requestId?: string;
  applicantNearAccount?: string;
  status?: FeedbackApplicationStatus;
  limit?: number;
  cursor?: string;
}

export interface CreateApplicationInput {
  requestId: string;
  applicantNearAccount: string;
  note?: string;
}

const randomId = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export interface ApplicationServiceMethods {
  listApplications: (filters: ListApplicationsFilters) => Effect.Effect<
    {
      data: FeedbackApplication[];
      meta: { total: number; hasMore: boolean; nextCursor: string | null };
    },
    ORPCError<string, unknown>
  >;
  applyToRequest: (
    input: CreateApplicationInput,
  ) => Effect.Effect<{ data: FeedbackApplication }, ORPCError<string, unknown>>;
  withdrawApplication: (
    id: string,
    applicantNearAccount: string,
  ) => Effect.Effect<{ data: FeedbackApplication }, ORPCError<string, unknown>>;
  countApplicationsForRequest: (
    requestId: string,
  ) => Effect.Effect<{ pending: number; selected: number }, ORPCError<string, unknown>>;
}

export class ApplicationService extends Context.Tag("feedback/ApplicationService")<
  ApplicationService,
  ApplicationServiceMethods
>() {}

export const ApplicationServiceLive = Layer.effect(
  ApplicationService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    const loadRequest = (requestId: string) =>
      Effect.tryPromise({
        try: () =>
          db.select().from(feedbackRequests).where(eq(feedbackRequests.id, requestId)).limit(1),
        catch: (cause) =>
          new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to load feedback request",
            data: { cause: String(cause) },
          }),
      });

    return {
      listApplications: (filters) =>
        Effect.gen(function* () {
          const conditions = [
            filters.requestId ? eq(feedbackApplications.requestId, filters.requestId) : undefined,
            filters.applicantNearAccount
              ? eq(feedbackApplications.applicantNearAccount, filters.applicantNearAccount)
              : undefined,
            filters.status ? eq(feedbackApplications.status, filters.status) : undefined,
          ].filter((c): c is NonNullable<typeof c> => c !== undefined);

          const where = conditions.length > 0 ? and(...conditions) : undefined;
          const limit = Math.min(filters.limit ?? 30, 50);
          const offset = filters.cursor ? Math.max(Number.parseInt(filters.cursor, 10) || 0, 0) : 0;

          const rows = yield* Effect.tryPromise({
            try: () =>
              db
                .select()
                .from(feedbackApplications)
                .where(where)
                .orderBy(desc(feedbackApplications.appliedAt))
                .limit(limit + 1)
                .offset(offset),
            catch: (cause) =>
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to list applications",
                data: { cause: String(cause) },
              }),
          });

          const hasMore = rows.length > limit;
          const page = hasMore ? rows.slice(0, limit) : rows;

          return {
            data: page as FeedbackApplication[],
            meta: {
              total: page.length,
              hasMore,
              nextCursor: hasMore ? String(offset + limit) : null,
            },
          };
        }),

      applyToRequest: (input) =>
        Effect.gen(function* () {
          const rows = yield* loadRequest(input.requestId);
          const request = rows[0];
          if (!request) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", {
                message: "Feedback request not found",
                data: { resource: "feedback-request" },
              }),
            );
          }
          if (request.status !== "open" && request.status !== "filling") {
            return yield* Effect.fail(
              new ORPCError("CONFLICT", {
                message: `This request is ${request.status} and no longer accepting applications`,
                data: { currentStatus: request.status },
              }),
            );
          }
          if (request.ownerNearAccount.toLowerCase() === input.applicantNearAccount.toLowerCase()) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "You can't apply to your own feedback request",
                data: { action: "applyToRequest" },
              }),
            );
          }
          if (new Date(request.expiresAt).getTime() <= Date.now()) {
            return yield* Effect.fail(
              new ORPCError("CONFLICT", {
                message: "This feedback request has expired",
                data: { expiresAt: request.expiresAt },
              }),
            );
          }

          const now = new Date().toISOString();
          const row = {
            id: randomId(),
            requestId: request.id,
            applicantNearAccount: input.applicantNearAccount.trim().toLowerCase(),
            note: input.note?.trim() || null,
            status: "pending" as const,
            requestTitle: request.title,
            requestProjectTitle: request.projectTitle,
            requestTargetRepo: request.targetRepo,
            appliedAt: now,
            decidedAt: null,
            decidedBy: null,
          };

          yield* Effect.tryPromise({
            try: () => db.insert(feedbackApplications).values(row),
            catch: (cause) => {
              const message = cause instanceof Error ? cause.message : String(cause);
              if (
                /duplicate key|unique/i.test(message) ||
                /feedback_applications_request_applicant_unique/i.test(message)
              ) {
                return new ORPCError("CONFLICT", {
                  message: "You've already applied to this request",
                  data: { currentStatus: "pending" as const },
                });
              }
              return new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to submit application",
                data: { cause: message },
              });
            },
          });

          if (request.status === "open") {
            yield* Effect.tryPromise({
              try: () =>
                db
                  .update(feedbackRequests)
                  .set({ status: "filling", updatedAt: now })
                  .where(eq(feedbackRequests.id, request.id)),
              catch: (cause) =>
                new ORPCError("INTERNAL_SERVER_ERROR", {
                  message: "Failed to update request status",
                  data: { cause: String(cause) },
                }),
            });
          }

          return { data: row as FeedbackApplication };
        }),

      withdrawApplication: (id, applicantNearAccount) =>
        Effect.gen(function* () {
          const rows = yield* Effect.tryPromise({
            try: () =>
              db
                .select()
                .from(feedbackApplications)
                .where(eq(feedbackApplications.id, id))
                .limit(1),
            catch: (cause) =>
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to load application",
                data: { cause: String(cause) },
              }),
          });
          const application = rows[0];
          if (!application) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", {
                message: "Application not found",
                data: { resource: "feedback-application" },
              }),
            );
          }
          if (
            application.applicantNearAccount.toLowerCase() !== applicantNearAccount.toLowerCase()
          ) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "You can only withdraw your own application",
                data: { action: "withdrawApplication" },
              }),
            );
          }
          if (application.status !== "pending") {
            return yield* Effect.fail(
              new ORPCError("CONFLICT", {
                message: `Application already ${application.status}`,
                data: { currentStatus: application.status },
              }),
            );
          }

          const now = new Date().toISOString();
          yield* Effect.tryPromise({
            try: () =>
              db
                .update(feedbackApplications)
                .set({
                  status: "withdrawn",
                  decidedAt: now,
                  decidedBy: applicantNearAccount.trim().toLowerCase(),
                })
                .where(eq(feedbackApplications.id, id)),
            catch: (cause) =>
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to withdraw application",
                data: { cause: String(cause) },
              }),
          });

          return {
            data: {
              ...application,
              status: "withdrawn" as const,
              decidedAt: now,
              decidedBy: applicantNearAccount.trim().toLowerCase(),
            } as FeedbackApplication,
          };
        }),

      countApplicationsForRequest: (requestId) =>
        Effect.gen(function* () {
          const rows = yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  status: feedbackApplications.status,
                  n: count(feedbackApplications.id),
                })
                .from(feedbackApplications)
                .where(
                  and(
                    eq(feedbackApplications.requestId, requestId),
                    sql`${feedbackApplications.status} IN ('pending', 'selected')`,
                  ),
                )
                .groupBy(feedbackApplications.status),
            catch: (cause) =>
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to count applications",
                data: { cause: String(cause) },
              }),
          });
          const pending = rows.find((r) => r.status === "pending")?.n ?? 0;
          const selected = rows.find((r) => r.status === "selected")?.n ?? 0;
          return { pending: Number(pending), selected: Number(selected) };
        }),
    };
  }),
);
