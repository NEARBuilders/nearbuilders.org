import { randomUUID } from "node:crypto";
import { and, asc, count, eq, isNotNull, lte, sql } from "drizzle-orm";
import type { Database } from "../db";
import { activityGatewayOutbox, activitySettings } from "../db/schema";

export const GATEWAY_MODES = ["legacy-only", "dual-write", "standalone-only"] as const;
export type GatewayMode = (typeof GATEWAY_MODES)[number];

export const GATEWAY_MODE_SETTING_KEY = "activity_gateway_mode";
const DEFAULT_MODE: GatewayMode = "legacy-only";
const MAX_ATTEMPTS = 8;
const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000, 900_000, 3_600_000] as const;

/**
 * Legacy `${source}:${type}` pairs and the Activity Event Types they become. Anything missing is
 * not forwarded: self-reported profile uploads stay legacy-only, because Activity signs everything
 * nearbuilders.org sends with its own source identity.
 */
export const GATEWAY_EVENT_TYPES: Readonly<Record<string, string>> = {
  "projects:approved": "project.approved",
  "events:approved": "event.approved",
  "builders:approved": "builder.approved",
  "nearcatalog:claim": "nearcatalog.claim",
};

export function gatewayEventType(source: string, type: string): string | null {
  return GATEWAY_EVENT_TYPES[`${source}:${type}`] ?? null;
}

export class ActivityGatewayRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "ActivityGatewayRequestError";
    this.retryable = retryable;
  }
}

export interface ActivityGatewayClient {
  submit(input: {
    eventType: string;
    actor: string;
    idempotencyKey: string;
    payload: unknown;
  }): Promise<{ eventId: string }>;
  retract(input: { eventId: string; reason: string; idempotencyKey: string }): Promise<void>;
}

/** 4xx other than 408 and 429 will never succeed on retry; everything else may. */
function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

export function createHttpActivityGatewayClient(options: {
  baseUrl: string;
  apiKey: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}): ActivityGatewayClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function request(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new ActivityGatewayRequestError(
        `Activity gateway is unreachable: ${cause instanceof Error ? cause.message : cause}`,
        true,
      );
    }
    const text = await response.text();
    if (!response.ok) {
      throw new ActivityGatewayRequestError(
        `Activity gateway returned ${response.status}: ${text.slice(0, 300)}`,
        isRetryableStatus(response.status),
      );
    }
    return text ? JSON.parse(text) : {};
  }

  return {
    async submit(input) {
      const result = (await request("/v1/events", input)) as { eventId?: unknown };
      if (typeof result.eventId !== "string") {
        throw new ActivityGatewayRequestError("Activity gateway returned no event ID", true);
      }
      return { eventId: result.eventId };
    },
    async retract(input) {
      await request(`/v1/events/${input.eventId}/retract`, {
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });
    },
  };
}

type OutboxRow = typeof activityGatewayOutbox.$inferSelect;

export type ActivityGatewayStatus = {
  mode: GatewayMode;
  configured: boolean;
  counts: { pending: number; sent: number; failed: number };
  oldestPendingAt: string | null;
  recentFailures: Array<{
    operation: string;
    idempotencyKey: string;
    attempts: number;
    lastError: string | null;
  }>;
};

export function createActivityGatewayMethods(
  db: Database,
  client: ActivityGatewayClient | null,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());

  function backoffFrom(attempts: number): Date {
    return new Date(now().getTime() + (BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] ?? 0));
  }

  async function getMode(): Promise<GatewayMode> {
    const [row] = await db
      .select()
      .from(activitySettings)
      .where(eq(activitySettings.key, GATEWAY_MODE_SETTING_KEY))
      .limit(1);
    const value = row?.value as GatewayMode | undefined;
    return value && GATEWAY_MODES.includes(value) ? value : DEFAULT_MODE;
  }

  async function setMode(mode: GatewayMode): Promise<GatewayMode> {
    await db
      .insert(activitySettings)
      .values({ key: GATEWAY_MODE_SETTING_KEY, value: mode, updatedAt: now() })
      .onConflictDoUpdate({
        target: activitySettings.key,
        set: { value: mode, updatedAt: now() },
      });
    return mode;
  }

  async function enqueuePublish(input: {
    legacyEventId: string;
    source: string;
    type: string;
    actor: string;
    payload: unknown;
    idempotencyKey: string;
  }): Promise<OutboxRow | null> {
    const eventType = gatewayEventType(input.source, input.type);
    if (!eventType) return null;
    const [row] = await db
      .insert(activityGatewayOutbox)
      .values({
        id: randomUUID(),
        operation: "publish",
        legacyEventId: input.legacyEventId,
        idempotencyKey: input.idempotencyKey,
        legacySource: input.source,
        legacyType: input.type,
        eventType,
        actor: input.actor,
        payload: input.payload ?? null,
        status: "pending",
        nextAttemptAt: now(),
        createdAt: now(),
        updatedAt: now(),
      })
      .onConflictDoNothing({
        target: [activityGatewayOutbox.operation, activityGatewayOutbox.idempotencyKey],
      })
      .returning();
    if (row) return row;
    const [existing] = await db
      .select()
      .from(activityGatewayOutbox)
      .where(
        and(
          eq(activityGatewayOutbox.operation, "publish"),
          eq(activityGatewayOutbox.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    return existing ?? null;
  }

  async function findPublished(legacyEventId: string): Promise<OutboxRow | null> {
    const [row] = await db
      .select()
      .from(activityGatewayOutbox)
      .where(
        and(
          eq(activityGatewayOutbox.operation, "publish"),
          eq(activityGatewayOutbox.legacyEventId, legacyEventId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async function enqueueRetract(input: {
    legacyEventId: string;
    reason: string;
  }): Promise<OutboxRow | null> {
    const published = await findPublished(input.legacyEventId);
    if (!published) return null;
    const [row] = await db
      .insert(activityGatewayOutbox)
      .values({
        id: randomUUID(),
        operation: "retract",
        legacyEventId: input.legacyEventId,
        idempotencyKey: `retract:${published.idempotencyKey}`,
        legacySource: published.legacySource,
        legacyType: published.legacyType,
        eventType: published.eventType,
        actor: published.actor,
        payload: null,
        reason: input.reason,
        status: "pending",
        nextAttemptAt: now(),
        createdAt: now(),
        updatedAt: now(),
      })
      .onConflictDoNothing({
        target: [activityGatewayOutbox.operation, activityGatewayOutbox.idempotencyKey],
      })
      .returning();
    return row ?? null;
  }

  async function markSent(row: OutboxRow, gatewayEventId: string | null): Promise<void> {
    await db
      .update(activityGatewayOutbox)
      .set({
        status: "sent",
        gatewayEventId: gatewayEventId ?? row.gatewayEventId,
        attempts: row.attempts + 1,
        lastError: null,
        updatedAt: now(),
      })
      .where(eq(activityGatewayOutbox.id, row.id));
  }

  async function markFailure(row: OutboxRow, error: unknown): Promise<void> {
    const retryable =
      error instanceof ActivityGatewayRequestError
        ? error.retryable
        : !(error instanceof TypeError);
    const attempts = row.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    await db
      .update(activityGatewayOutbox)
      .set({
        status: retryable && !exhausted ? "pending" : "failed",
        attempts,
        lastError: error instanceof Error ? error.message.slice(0, 1_000) : String(error),
        nextAttemptAt: backoffFrom(attempts),
        updatedAt: now(),
      })
      .where(eq(activityGatewayOutbox.id, row.id));
  }

  async function send(row: OutboxRow): Promise<void> {
    if (!client) throw new ActivityGatewayRequestError("Activity gateway is not configured", true);
    if (row.operation === "publish") {
      const { eventId } = await client.submit({
        eventType: row.eventType,
        actor: row.actor,
        idempotencyKey: row.idempotencyKey,
        payload: row.payload ?? {},
      });
      await markSent(row, eventId);
      return;
    }
    const [published] = await db
      .select()
      .from(activityGatewayOutbox)
      .where(
        and(
          eq(activityGatewayOutbox.operation, "publish"),
          eq(activityGatewayOutbox.legacyEventId, row.legacyEventId),
          isNotNull(activityGatewayOutbox.gatewayEventId),
        ),
      )
      .limit(1);
    if (!published?.gatewayEventId) {
      // The publish has not reached Activity yet; retry after the publish row is sent.
      throw new ActivityGatewayRequestError(
        "Waiting for the published event to reach Activity",
        true,
      );
    }
    await client.retract({
      eventId: published.gatewayEventId,
      reason: row.reason ?? "Retracted by nearbuilders.org",
      idempotencyKey: row.idempotencyKey,
    });
    await markSent(row, published.gatewayEventId);
  }

  /** Sends one row now. Failures are recorded, never thrown, so callers are not blocked. */
  async function trySend(row: OutboxRow | null): Promise<void> {
    if (!row || row.status !== "pending") return;
    try {
      await send(row);
    } catch (error) {
      await markFailure(row, error);
    }
  }

  async function processDue(limit = 20): Promise<{ processed: number }> {
    const due = await db
      .select()
      .from(activityGatewayOutbox)
      .where(
        and(
          eq(activityGatewayOutbox.status, "pending"),
          lte(activityGatewayOutbox.nextAttemptAt, now()),
        ),
      )
      // Publishes first, so a retract in the same batch finds its event ID.
      .orderBy(asc(activityGatewayOutbox.operation), asc(activityGatewayOutbox.createdAt))
      .limit(limit);
    for (const row of due) await trySend(row);
    return { processed: due.length };
  }

  async function status(): Promise<ActivityGatewayStatus> {
    const counts = await db
      .select({ status: activityGatewayOutbox.status, total: count() })
      .from(activityGatewayOutbox)
      .groupBy(activityGatewayOutbox.status);
    const [oldest] = await db
      .select({ createdAt: sql<Date>`min(${activityGatewayOutbox.createdAt})` })
      .from(activityGatewayOutbox)
      .where(eq(activityGatewayOutbox.status, "pending"));
    const failures = await db
      .select()
      .from(activityGatewayOutbox)
      .where(eq(activityGatewayOutbox.status, "failed"))
      .orderBy(asc(activityGatewayOutbox.updatedAt))
      .limit(10);
    const byStatus = new Map(counts.map(({ status: value, total }) => [value, Number(total)]));
    const oldestPendingAt = oldest?.createdAt ? new Date(oldest.createdAt).toISOString() : null;
    return {
      mode: await getMode(),
      configured: client !== null,
      counts: {
        pending: byStatus.get("pending") ?? 0,
        sent: byStatus.get("sent") ?? 0,
        failed: byStatus.get("failed") ?? 0,
      },
      oldestPendingAt,
      recentFailures: failures.map((row) => ({
        operation: row.operation,
        idempotencyKey: row.idempotencyKey,
        attempts: row.attempts,
        lastError: row.lastError,
      })),
    };
  }

  return {
    getMode,
    setMode,
    enqueuePublish,
    enqueueRetract,
    findPublished,
    trySend,
    processDue,
    status,
  };
}

export type ActivityGatewayMethods = ReturnType<typeof createActivityGatewayMethods>;

/** Retries outbox rows in the background so a gateway outage recovers without a deploy. */
export class ActivityGatewayWorker {
  readonly #gateway: ActivityGatewayMethods;
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;

  constructor(gateway: ActivityGatewayMethods) {
    this.#gateway = gateway;
  }

  start(intervalMs = 30_000): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      if (this.#running) return;
      this.#running = true;
      void this.#gateway
        .processDue()
        .catch((error) => console.error("[ActivityGateway] Retry pass failed", error))
        .finally(() => {
          this.#running = false;
        });
    }, intervalMs);
    this.#timer.unref?.();
  }

  stop(): void {
    if (!this.#timer) return;
    clearInterval(this.#timer);
    this.#timer = null;
  }
}
