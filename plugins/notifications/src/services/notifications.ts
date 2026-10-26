import { timingSafeEqual } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { emailPreferences, notifications } from "../db/schema";

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

export interface EmailPreferenceRecord {
  email: string | null;
  verified: boolean;
  enabled: boolean;
  pendingEmail: string | null;
}

function emptyEmailPreference(): EmailPreferenceRecord {
  return { email: null, verified: false, enabled: true, pendingEmail: null };
}

function rowToEmailPreference(
  row: typeof emailPreferences.$inferSelect | undefined,
): EmailPreferenceRecord {
  if (!row) return emptyEmailPreference();
  return {
    email: row.email,
    verified: Boolean(row.email && row.verifiedAt),
    enabled: row.enabled,
    pendingEmail: row.pendingEmail,
  };
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
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

export class NotificationService extends Context.Tag("notifications/NotificationService")<
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
    getEmailPreference: (
      userId: string,
    ) => Effect.Effect<EmailPreferenceRecord, ORPCError<string, unknown>>;
    setEmailNotificationsEnabled: (
      userId: string,
      enabled: boolean,
    ) => Effect.Effect<EmailPreferenceRecord, ORPCError<string, unknown>>;
    setEmailChallenge: (input: {
      userId: string;
      pendingEmail: string;
      codeHash: string;
      codeExpiresAt: string;
    }) => Effect.Effect<{ pendingEmail: string }, ORPCError<string, unknown>>;
    confirmEmailCode: (input: {
      userId: string;
      codeHash: string;
    }) => Effect.Effect<EmailPreferenceRecord, ORPCError<string, unknown>>;
    syncVerifiedEmail: (input: {
      userId: string;
      email: string;
    }) => Effect.Effect<EmailPreferenceRecord, ORPCError<string, unknown>>;
  }
>() {}

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

      getEmailPreference: (userId) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db.select().from(emailPreferences).where(eq(emailPreferences.userId, userId)).limit(1),
          );
          return rowToEmailPreference(row);
        }),

      setEmailNotificationsEnabled: (userId, enabled) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db
              .insert(emailPreferences)
              .values({ userId, enabled })
              .onConflictDoUpdate({
                target: emailPreferences.userId,
                set: { enabled },
              })
              .returning(),
          );
          return rowToEmailPreference(row);
        }),

      setEmailChallenge: (input) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            db
              .insert(emailPreferences)
              .values({
                userId: input.userId,
                pendingEmail: input.pendingEmail,
                codeHash: input.codeHash,
                codeExpiresAt: new Date(input.codeExpiresAt),
              })
              .onConflictDoUpdate({
                target: emailPreferences.userId,
                set: {
                  pendingEmail: input.pendingEmail,
                  codeHash: input.codeHash,
                  codeExpiresAt: new Date(input.codeExpiresAt),
                },
              }),
          );
          return { pendingEmail: input.pendingEmail };
        }),

      confirmEmailCode: (input) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db
              .select()
              .from(emailPreferences)
              .where(eq(emailPreferences.userId, input.userId))
              .limit(1),
          );
          const expiresAt = row?.codeExpiresAt ? new Date(row.codeExpiresAt).getTime() : 0;
          if (
            !row?.pendingEmail ||
            !row.codeHash ||
            !hashesMatch(row.codeHash, input.codeHash) ||
            expiresAt <= Date.now()
          ) {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "That code is invalid or expired" }),
            );
          }

          const [updated] = yield* Effect.promise(() =>
            db
              .update(emailPreferences)
              .set({
                email: row.pendingEmail,
                verifiedAt: new Date(),
                pendingEmail: null,
                codeHash: null,
                codeExpiresAt: null,
                enabled: true,
              })
              .where(eq(emailPreferences.userId, input.userId))
              .returning(),
          );
          return rowToEmailPreference(updated);
        }),

      syncVerifiedEmail: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(emailPreferences)
              .where(eq(emailPreferences.userId, input.userId))
              .limit(1),
          );
          if (existing?.email && existing.verifiedAt && existing.email !== input.email) {
            return rowToEmailPreference(existing);
          }
          const [row] = yield* Effect.promise(() =>
            db
              .insert(emailPreferences)
              .values({
                userId: input.userId,
                email: input.email,
                verifiedAt: new Date(),
                enabled: existing?.enabled ?? true,
              })
              .onConflictDoUpdate({
                target: emailPreferences.userId,
                set: {
                  email: input.email,
                  verifiedAt: new Date(),
                },
              })
              .returning(),
          );
          return rowToEmailPreference(row);
        }),
    };
  }),
);
