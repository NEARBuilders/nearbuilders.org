import { and, asc, gte, inArray, isNotNull } from "drizzle-orm";
import type { Database } from "../db";
import { activityEvents, activityGatewayOutbox } from "../db/schema";
import { type ActivityGatewayMethods, gatewayEventType } from "./activity-gateway";

const BATCH_SIZE = 500;

export type ActivityImportPlan = {
  dryRun: boolean;
  scanned: number;
  eligible: number;
  alreadyForwarded: number;
  toImport: number;
  hidden: number;
  synthesizedKeys: number;
  skippedByType: Array<{ source: string; type: string; count: number }>;
  oldestOccurredAt: string | null;
  newestOccurredAt: string | null;
  timestamps: {
    preserved: boolean;
    note: string;
    olderThanCurrentWeek: number;
    olderThanCurrentMonth: number;
  };
  enqueued: number;
  enqueuedRetractions: number;
};

/** Legacy rows may predate idempotency keys; the row ID is stable, so derive one from it. */
export function importIdempotencyKey(row: { id: string; idempotencyKey: string | null }): string {
  return row.idempotencyKey ?? `legacy:${row.id}`;
}

/**
 * Activity signs an event when it receives it, so imported history carries today's timestamp.
 * The original time is preserved inside the payload instead, and the plan reports how many events
 * would move into the current leaderboard period.
 */
export function importPayload(row: {
  id: string;
  payload: unknown;
  createdAt: Date;
  hiddenAt: Date | null;
}): Record<string, unknown> {
  const original =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : { value: row.payload ?? null };
  return {
    ...original,
    legacyEventId: row.id,
    occurredAt: row.createdAt.toISOString(),
    ...(row.hiddenAt ? { legacyHiddenAt: row.hiddenAt.toISOString() } : {}),
  };
}

function startOfWeek(now: Date): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const weekday = (start.getUTCDay() + 6) % 7; // Monday is 0, matching Activity's buckets
  start.setUTCDate(start.getUTCDate() - weekday);
  return start;
}

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function createActivityImportMethods(
  db: Database,
  gateway: Pick<ActivityGatewayMethods, "enqueuePublish" | "enqueueRetract" | "trySend">,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());

  async function plan(
    input: { dryRun?: boolean; since?: Date; limit?: number } = {},
  ): Promise<ActivityImportPlan> {
    const dryRun = input.dryRun ?? true;
    const at = now();
    const weekStart = startOfWeek(at);
    const monthStart = startOfMonth(at);
    const skipped = new Map<string, { source: string; type: string; count: number }>();
    const report: ActivityImportPlan = {
      dryRun,
      scanned: 0,
      eligible: 0,
      alreadyForwarded: 0,
      toImport: 0,
      hidden: 0,
      synthesizedKeys: 0,
      skippedByType: [],
      oldestOccurredAt: null,
      newestOccurredAt: null,
      timestamps: {
        preserved: false,
        note: "Activity signs an event when it receives it. Imported events carry today's timestamp; the original time is kept in the payload as occurredAt.",
        olderThanCurrentWeek: 0,
        olderThanCurrentMonth: 0,
      },
      enqueued: 0,
      enqueuedRetractions: 0,
    };

    let offset = 0;
    for (;;) {
      const rows = await db
        .select()
        .from(activityEvents)
        .where(input.since ? gte(activityEvents.createdAt, input.since) : undefined)
        .orderBy(asc(activityEvents.createdAt), asc(activityEvents.id))
        .limit(BATCH_SIZE)
        .offset(offset);
      if (rows.length === 0) break;
      offset += rows.length;
      report.scanned += rows.length;

      const mapped = rows.filter((row) => gatewayEventType(row.source, row.type) !== null);
      for (const row of rows) {
        if (gatewayEventType(row.source, row.type)) continue;
        const key = `${row.source}:${row.type}`;
        const entry = skipped.get(key) ?? { source: row.source, type: row.type, count: 0 };
        entry.count += 1;
        skipped.set(key, entry);
      }
      report.eligible += mapped.length;
      if (mapped.length === 0) {
        if (input.limit && report.toImport >= input.limit) break;
        continue;
      }

      const forwarded = new Set(
        (
          await db
            .select({ legacyEventId: activityGatewayOutbox.legacyEventId })
            .from(activityGatewayOutbox)
            .where(
              and(
                inArray(
                  activityGatewayOutbox.legacyEventId,
                  mapped.map((row) => row.id),
                ),
                isNotNull(activityGatewayOutbox.legacyEventId),
              ),
            )
        ).map(({ legacyEventId }) => legacyEventId),
      );

      for (const row of mapped) {
        if (forwarded.has(row.id)) {
          report.alreadyForwarded += 1;
          continue;
        }
        if (input.limit && report.toImport >= input.limit) break;
        report.toImport += 1;
        if (row.hiddenAt) report.hidden += 1;
        if (!row.idempotencyKey) report.synthesizedKeys += 1;
        const occurredAt = row.createdAt;
        if (occurredAt < weekStart) report.timestamps.olderThanCurrentWeek += 1;
        if (occurredAt < monthStart) report.timestamps.olderThanCurrentMonth += 1;
        const iso = occurredAt.toISOString();
        if (!report.oldestOccurredAt || iso < report.oldestOccurredAt)
          report.oldestOccurredAt = iso;
        if (!report.newestOccurredAt || iso > report.newestOccurredAt)
          report.newestOccurredAt = iso;

        if (dryRun) continue;
        const published = await gateway.enqueuePublish({
          legacyEventId: row.id,
          source: row.source,
          type: row.type,
          actor: row.actor,
          payload: importPayload(row),
          idempotencyKey: importIdempotencyKey(row),
        });
        if (published) report.enqueued += 1;
        await gateway.trySend(published);
        if (row.hiddenAt) {
          const retraction = await gateway.enqueueRetract({
            legacyEventId: row.id,
            reason: "Hidden in nearbuilders.org before the import",
          });
          if (retraction) report.enqueuedRetractions += 1;
          await gateway.trySend(retraction);
        }
      }
      if (input.limit && report.toImport >= input.limit) break;
    }

    report.skippedByType = [...skipped.values()].sort((left, right) => right.count - left.count);
    return report;
  }

  return { plan };
}

export type ActivityImportMethods = ReturnType<typeof createActivityImportMethods>;
