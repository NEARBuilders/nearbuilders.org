import { and, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type { FeedbackRequestSchema, FeedbackRequestStatus } from "../contract";
import { DatabaseTag } from "../db/layer";
import { feedbackRequests } from "../db/schema";

type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

export interface ListFilters {
  status?: FeedbackRequestStatus;
  ownerNearAccount?: string;
  projectId?: string;
  limit?: number;
  cursor?: string;
}

export interface CreateInput {
  ownerNearAccount: string;
  projectId: string;
  projectSlug: string;
  projectKind: FeedbackRequest["projectKind"];
  projectTitle: string;
  title: string;
  body: string;
  testersWanted: number;
  timeframeDays: number;
  targetRepo: string;
  requirements?: string;
}

const randomId = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export interface RequestServiceMethods {
  listRequests: (filters: ListFilters) => Effect.Effect<
    {
      data: FeedbackRequest[];
      meta: { total: number; hasMore: boolean; nextCursor: string | null };
    },
    ORPCError<string, unknown>
  >;
  getRequest: (id: string) => Effect.Effect<{ data: FeedbackRequest }, ORPCError<string, unknown>>;
  createRequest: (
    input: CreateInput,
  ) => Effect.Effect<{ data: FeedbackRequest }, ORPCError<string, unknown>>;
}

export class RequestService extends Context.Tag("feedback/RequestService")<
  RequestService,
  RequestServiceMethods
>() {}

export const RequestServiceLive = Layer.effect(
  RequestService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    return {
      listRequests: (filters) =>
        Effect.gen(function* () {
          const conditions = [
            filters.status ? eq(feedbackRequests.status, filters.status) : undefined,
            filters.ownerNearAccount
              ? eq(feedbackRequests.ownerNearAccount, filters.ownerNearAccount)
              : undefined,
            filters.projectId ? eq(feedbackRequests.projectId, filters.projectId) : undefined,
          ].filter((c): c is NonNullable<typeof c> => c !== undefined);

          const where = conditions.length > 0 ? and(...conditions) : undefined;
          const limit = Math.min(filters.limit ?? 30, 50);
          const offset = filters.cursor ? Math.max(Number.parseInt(filters.cursor, 10) || 0, 0) : 0;

          const rows = yield* Effect.tryPromise({
            try: () =>
              db
                .select()
                .from(feedbackRequests)
                .where(where)
                .orderBy(desc(feedbackRequests.createdAt))
                .limit(limit + 1)
                .offset(offset),
            catch: (cause) =>
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to list feedback requests",
                data: { cause: String(cause) },
              }),
          });

          const hasMore = rows.length > limit;
          const page = hasMore ? rows.slice(0, limit) : rows;

          return {
            data: page as FeedbackRequest[],
            meta: {
              total: page.length,
              hasMore,
              nextCursor: hasMore ? String(offset + limit) : null,
            },
          };
        }),

      getRequest: (id) =>
        Effect.gen(function* () {
          const row = yield* Effect.tryPromise({
            try: () =>
              db.select().from(feedbackRequests).where(eq(feedbackRequests.id, id)).limit(1),
            catch: (cause) =>
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to load feedback request",
                data: { cause: String(cause) },
              }),
          });
          const found = row[0];
          if (!found) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", {
                message: "Feedback request not found",
                data: { resource: "feedback-request" },
              }),
            );
          }
          return { data: found as FeedbackRequest };
        }),

      createRequest: (input) =>
        Effect.gen(function* () {
          const now = new Date();
          const expires = new Date(now.getTime() + input.timeframeDays * 24 * 60 * 60 * 1000);
          const row = {
            id: randomId(),
            ownerNearAccount: input.ownerNearAccount,
            projectId: input.projectId,
            projectSlug: input.projectSlug,
            projectKind: input.projectKind,
            projectTitle: input.projectTitle,
            title: input.title,
            body: input.body,
            testersWanted: input.testersWanted,
            timeframeDays: input.timeframeDays,
            targetRepo: input.targetRepo,
            requirements: input.requirements ?? null,
            status: "open" as const,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            expiresAt: expires.toISOString(),
          };

          yield* Effect.tryPromise({
            try: () => db.insert(feedbackRequests).values(row),
            catch: (cause) =>
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to create feedback request",
                data: { cause: String(cause) },
              }),
          });

          return { data: row as FeedbackRequest };
        }),
    };
  }),
);
