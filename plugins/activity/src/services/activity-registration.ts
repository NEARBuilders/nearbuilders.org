import { ORPCError } from "every-plugin/orpc";

export interface ActivityRegistrationEventType {
  name: string;
  pointValue: number;
}

export interface ActivityProjectStatus {
  status: "none" | "connected" | "tracked" | "rejected";
  sourceId: string | null;
  displayName: string | null;
  reviewReason: string | null;
  activityUrl: string;
}

export interface ActivityProjectEvent {
  id: string;
  type: string;
  actor: string;
  occurredAt: string;
  underReview: boolean;
}

export interface ActivityProjectEvents {
  events: ActivityProjectEvent[];
  nextCursor: string | null;
}

export interface ActivityProjectContributor {
  rank: number;
  actor: string;
  score: number;
  eventCount: number;
}

export interface ActivityRegistrationClient {
  startSession(input: {
    projectId: string;
    nearAccountId?: string;
    eventTypes: ActivityRegistrationEventType[];
  }): Promise<{ url: string; expiresAt: string }>;
  projectStatus(projectId: string): Promise<ActivityProjectStatus>;
  projectEvents(projectId: string, cursor?: string): Promise<ActivityProjectEvents>;
  projectContributors(projectId: string): Promise<ActivityProjectContributor[]>;
}

const PROJECT_EVENTS_PAGE_SIZE = 10;
const PROJECT_CONTRIBUTORS_LIMIT = 5;

export function activitySiteUrl(gatewayUrl: string): string {
  return gatewayUrl.replace(/\/+$/, "").replace(/\/api$/, "");
}

export function createActivityRegistrationClient(options: {
  baseUrl: string;
  apiKey: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}): ActivityRegistrationClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function call(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        message: "Activity could not be reached. Try again shortly.",
      });
    }
    const text = await response.text();
    const body = text ? (JSON.parse(text) as { message?: unknown }) : {};
    if (!response.ok) {
      const message =
        typeof body.message === "string" ? body.message : `Activity returned ${response.status}`;
      throw new ORPCError(response.status >= 500 ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST", {
        message,
      });
    }
    return body;
  }

  async function projectStatus(projectId: string): Promise<ActivityProjectStatus> {
    const body = (await call(`/v1/projects/${encodeURIComponent(projectId)}/activity`, {
      method: "GET",
      headers: { accept: "application/json" },
    })) as Partial<ActivityProjectStatus>;
    return {
      status: body.status ?? "none",
      sourceId: body.sourceId ?? null,
      displayName: body.displayName ?? null,
      reviewReason: body.reviewReason ?? null,
      activityUrl: activitySiteUrl(baseUrl),
    };
  }

  async function trackedSourceId(projectId: string): Promise<string | null> {
    const status = await projectStatus(projectId);
    return status.status === "connected" || status.status === "tracked" ? status.sourceId : null;
  }

  return {
    async startSession(input) {
      const body = (await call("/v1/binding-sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          project: { id: input.projectId },
          ...(input.nearAccountId && { nearAccountId: input.nearAccountId }),
          eventTypes: input.eventTypes.map(({ name, pointValue }) => ({
            name,
            description: "",
            enabled: true,
            pointValue,
          })),
        }),
      })) as { url?: unknown; expiresAt?: unknown };
      if (typeof body.url !== "string" || typeof body.expiresAt !== "string") {
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "Activity returned an unexpected response",
        });
      }
      return { url: body.url, expiresAt: body.expiresAt };
    },

    async projectStatus(projectId) {
      return projectStatus(projectId);
    },

    async projectEvents(projectId, cursor) {
      const sourceId = await trackedSourceId(projectId);
      if (!sourceId) return { events: [], nextCursor: null };
      const query = new URLSearchParams({
        source: sourceId,
        limit: String(PROJECT_EVENTS_PAGE_SIZE),
      });
      if (cursor) query.set("cursor", cursor);
      const body = (await call(`/v1/events?${query}`, {
        method: "GET",
        headers: { accept: "application/json" },
      })) as {
        data?: Array<{
          id: string;
          type: string;
          actor: string;
          timestamp: string;
          provenance?: { approvalStatus?: string };
        }>;
        meta?: { hasMore?: boolean; nextCursor?: string | null };
      };
      return {
        events: (body.data ?? []).map((event) => ({
          id: event.id,
          type: event.type,
          actor: event.actor,
          occurredAt: event.timestamp,
          underReview: event.provenance?.approvalStatus === "pending",
        })),
        nextCursor: body.meta?.hasMore ? (body.meta.nextCursor ?? null) : null,
      };
    },

    async projectContributors(projectId) {
      const sourceId = await trackedSourceId(projectId);
      if (!sourceId) return [];
      const query = new URLSearchParams({
        source: sourceId,
        period: "all-time",
        limit: String(PROJECT_CONTRIBUTORS_LIMIT),
      });
      const body = (await call(`/v1/leaderboard?${query}`, {
        method: "GET",
        headers: { accept: "application/json" },
      })) as {
        data?: Array<{ rank: number; actor: string; score: number; eventCount: number }>;
      };
      return (body.data ?? []).map(({ rank, actor, score, eventCount }) => ({
        rank,
        actor,
        score,
        eventCount,
      }));
    },
  };
}
