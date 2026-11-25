import { randomUUID, timingSafeEqual } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DatabaseTag } from "../db/layer";
import { emailCodeRequests, emailPreferences, notifications } from "../db/schema";
import {
  codeRequestRetryAfterMs,
  EMAIL_CODE_COOLDOWN_MS,
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_WINDOW_MS,
  formatWait,
  normalizeEmailAddress,
} from "./email-limits";

function rateLimited(message: string, retryAfterSeconds: number) {
  return new ORPCError("RATE_LIMITED", {
    message,
    data: { retryAfter: Math.max(1, Math.ceil(retryAfterSeconds)) },
  });
}

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

/** Notifications addressed to any of the caller's ids (#364). */
function listWhere(recipientIds: readonly string[], read?: boolean) {
  const mine = inArray(notifications.userId, [...recipientIds]);
  return read === undefined ? mine : and(mine, eq(notifications.read, read));
}

export class NotificationService extends Context.Service<
  NotificationService,
  {
    createNotification: (
      input: CreateNotificationInput,
    ) => Effect.Effect<NotificationRecord, ORPCError<string, unknown>>;
    getMyNotifications: (
      recipientIds: readonly string[],
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
      recipientIds: readonly string[],
    ) => Effect.Effect<NotificationRecord, ORPCError<string, unknown>>;
    markAllAsRead: (
      recipientIds: readonly string[],
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

      getMyNotifications: (recipientIds, input) =>
        Effect.gen(function* () {
          const limit = Math.min(input.limit ?? 20, 100);
          const offset = input.cursor ? Math.max(Number.parseInt(input.cursor, 10) || 0, 0) : 0;
          const where = listWhere(recipientIds, input.read);

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

      markAsRead: (id, recipientIds) =>
        Effect.gen(function* () {
          const [updated] = yield* Effect.promise(() =>
            db
              .update(notifications)
              .set({ read: true })
              .where(
                and(eq(notifications.id, id), inArray(notifications.userId, [...recipientIds])),
              )
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

      markAllAsRead: (recipientIds) =>
        Effect.gen(function* () {
          const updated = yield* Effect.promise(() =>
            db
              .update(notifications)
              .set({ read: true })
              .where(
                and(
                  inArray(notifications.userId, [...recipientIds]),
                  eq(notifications.read, false),
                ),
              )
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
          const now = Date.now();
          const windowStart = new Date(now - EMAIL_CODE_WINDOW_MS);
          const address = normalizeEmailAddress(input.pendingEmail);
          const requestId = randomUUID();

          yield* Effect.promise(() =>
            db.delete(emailCodeRequests).where(lt(emailCodeRequests.requestedAt, windowStart)),
          );
          yield* Effect.promise(() =>
            db.insert(emailCodeRequests).values({
              id: requestId,
              userId: input.userId,
              email: address,
              requestedAt: new Date(now),
            }),
          );
          const recent = (
            column: typeof emailCodeRequests.userId | typeof emailCodeRequests.email,
            value: string,
          ) =>
            db
              .select({ requestedAt: emailCodeRequests.requestedAt })
              .from(emailCodeRequests)
              .where(
                and(
                  eq(column, value),
                  ne(emailCodeRequests.id, requestId),
                  gte(emailCodeRequests.requestedAt, windowStart),
                ),
              )
              .orderBy(desc(emailCodeRequests.requestedAt))
              .then((rows) => rows.map((row) => row.requestedAt));
          const [byUser, byAddress] = yield* Effect.promise(() =>
            Promise.all([
              recent(emailCodeRequests.userId, input.userId),
              recent(emailCodeRequests.email, address),
            ]),
          );

          const retryAfterMs = codeRequestRetryAfterMs(byUser, byAddress, now);
          if (retryAfterMs > 0) {
            yield* Effect.promise(() =>
              db.delete(emailCodeRequests).where(eq(emailCodeRequests.id, requestId)),
            );
            const retryAfter = Math.ceil(retryAfterMs / 1000);
            return yield* Effect.fail(
              rateLimited(
                `Too many verification codes requested. Try again in ${formatWait(retryAfter)}.`,
                retryAfter,
              ),
            );
          }

          yield* Effect.promise(() =>
            db
              .insert(emailPreferences)
              .values({
                userId: input.userId,
                pendingEmail: input.pendingEmail,
                codeHash: input.codeHash,
                codeExpiresAt: new Date(input.codeExpiresAt),
                codeAttempts: 0,
              })
              .onConflictDoUpdate({
                target: emailPreferences.userId,
                set: {
                  pendingEmail: input.pendingEmail,
                  codeHash: input.codeHash,
                  codeExpiresAt: new Date(input.codeExpiresAt),
                  codeAttempts: 0,
                },
              }),
          );
          return { pendingEmail: input.pendingEmail };
        }),

      confirmEmailCode: (input) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db
              .update(emailPreferences)
              .set({ codeAttempts: sql`${emailPreferences.codeAttempts} + 1` })
              .where(
                and(
                  eq(emailPreferences.userId, input.userId),
                  isNotNull(emailPreferences.codeHash),
                  lt(emailPreferences.codeAttempts, EMAIL_CODE_MAX_ATTEMPTS),
                ),
              )
              .returning(),
          );
          if (!row) {
            const [existing] = yield* Effect.promise(() =>
              db
                .select()
                .from(emailPreferences)
                .where(eq(emailPreferences.userId, input.userId))
                .limit(1),
            );
            if (existing?.codeHash && existing.codeAttempts >= EMAIL_CODE_MAX_ATTEMPTS) {
              return yield* Effect.fail(
                rateLimited(
                  "Too many incorrect codes. Request a new code to try again.",
                  EMAIL_CODE_COOLDOWN_MS / 1000,
                ),
              );
            }
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "That code is invalid or expired" }),
            );
          }
          const expiresAt = row.codeExpiresAt ? new Date(row.codeExpiresAt).getTime() : 0;
          if (
            !row.pendingEmail ||
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
                codeAttempts: 0,
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
