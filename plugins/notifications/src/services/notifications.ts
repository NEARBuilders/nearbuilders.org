import { ORPCError } from "@orpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DatabaseTag } from "../db/layer";
import { notifications } from "../db/schema";

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  source: string;
  subject: string;
  body: string | null;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  source: string;
  subject: string;
  body?: string;
  link?: string;
}

export interface ListNotificationsInput {
  read?: boolean;
  limit?: number;
  cursor?: string;
}

function generateId(): string {
  return `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function rowToNotification(row: typeof notifications.$inferSelect): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    source: row.source,
    subject: row.subject,
    body: row.body,
    link: row.link,
    read: row.read,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

function listWhere(userId: string, read?: boolean) {
  return read === undefined
    ? eq(notifications.userId, userId)
    : and(eq(notifications.userId, userId), eq(notifications.read, read));
}

export class NotificationService extends Context.Service<
  NotificationService,
  {
    createNotification: (
      input: CreateNotificationInput,
    ) => Effect.Effect<NotificationRecord, ORPCError<string, unknown>>;
    getMyNotifications: (
      userId: string,
      input: ListNotificationsInput,
    ) => Effect.Effect<
      {
        data: NotificationRecord[];
        meta: { total: number; hasMore: boolean; nextCursor: string | null };
      },
      ORPCError<string, unknown>
    >;
    markAsRead: (
      id: string,
      userId: string,
    ) => Effect.Effect<NotificationRecord, ORPCError<string, unknown>>;
    markAllAsRead: (
      userId: string,
    ) => Effect.Effect<{ updated: number }, ORPCError<string, unknown>>;
  }
>()("notifications/NotificationService") {}

export const NotificationServiceLive = Layer.effect(
  NotificationService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    return {
      createNotification: (input) =>
        Effect.gen(function* () {
          const [created] = yield* Effect.promise(() =>
            db
              .insert(notifications)
              .values({
                id: generateId(),
                userId: input.userId,
                type: input.type,
                source: input.source,
                subject: input.subject,
                body: input.body ?? null,
                link: input.link ?? "",
              })
              .returning(),
          );

          if (!created) {
            return yield* Effect.fail(
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Could not create notification",
              }),
            );
          }

          return rowToNotification(created);
        }),

      getMyNotifications: (userId, input) =>
        Effect.gen(function* () {
          const limit = Math.min(input.limit ?? 20, 100);
          const offset = input.cursor ? Math.max(Number.parseInt(input.cursor, 10) || 0, 0) : 0;
          const where = listWhere(userId, input.read);

          const [totalRow] = yield* Effect.promise(() =>
            db.select({ count: count() }).from(notifications).where(where),
          );
          const rows = yield* Effect.promise(() =>
            db
              .select()
              .from(notifications)
              .where(where)
              .orderBy(desc(notifications.createdAt))
              .limit(limit + 1)
              .offset(offset),
          );

          const hasMore = rows.length > limit;
          const data = rows.slice(0, limit).map(rowToNotification);

          return {
            data,
            meta: {
              total: totalRow?.count ?? 0,
              hasMore,
              nextCursor: hasMore ? String(offset + limit) : null,
            },
          };
        }),

      markAsRead: (id, userId) =>
        Effect.gen(function* () {
          const [updated] = yield* Effect.promise(() =>
            db
              .update(notifications)
              .set({ read: true })
              .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
              .returning(),
          );

          if (!updated) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", {
                message: "Notification not found",
                data: { resource: "notification", resourceId: id },
              }),
            );
          }

          return rowToNotification(updated);
        }),

      markAllAsRead: (userId) =>
        Effect.gen(function* () {
          const updated = yield* Effect.promise(() =>
            db
              .update(notifications)
              .set({ read: true })
              .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
              .returning({ id: notifications.id }),
          );

          return { updated: updated.length };
        }),
    };
  }),
);
