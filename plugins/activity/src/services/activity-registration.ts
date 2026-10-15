import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type {
  ActivityProjectContributorsSchema,
  ActivityProjectEventsSchema,
  ActivityProjectStatusSchema,
  ActivityRegistrationInputSchema,
} from "../contract";
import { ActivityApiBindingSessionSchema, ActivityApiProjectStatusSchema } from "./activity-api";
import { type ActivityReaderClient, createActivityReaderClient } from "./activity-reader";
import { createTtlCache } from "./ttl-cache";

type ActivityRegistrationInput = z.infer<typeof ActivityRegistrationInputSchema>;
type ActivityProjectStatus = z.infer<typeof ActivityProjectStatusSchema>;
type ActivityProjectEvents = z.infer<typeof ActivityProjectEventsSchema>;
type ActivityProjectContributors = z.infer<typeof ActivityProjectContributorsSchema>;

const PROJECT_EVENTS_PAGE_SIZE = 10;
const PROJECT_CONTRIBUTORS_LIMIT = 5;

export function activitySiteUrl(gatewayUrl: string): string {
  return gatewayUrl.replace(/\/+$/, "").replace(/\/api$/, "");
}

function unavailable(): ORPCError<"SERVICE_UNAVAILABLE", unknown> {
  return new ORPCError("SERVICE_UNAVAILABLE", {
    message: "Activity could not be reached. Try again shortly.",
  });
}

export function createActivityRegistrationClient(options: {
  baseUrl: string;
  apiKey: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
  reader?: ActivityReaderClient;
  statusCacheMs?: number;
}) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const reader =
    options.reader ?? createActivityReaderClient({ baseUrl, fetchImplementation, timeoutMs });
  const statuses = createTtlCache<ActivityProjectStatus>({
    ttlMs: options.statusCacheMs ?? 30_000,
    maxEntries: 1_000,
  });

  async function call(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw unavailable();
    }
    const text = await response.text();
    const body: unknown = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : `Activity returned ${response.status}`;
      throw new ORPCError(response.status >= 500 ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST", {
        message,
      });
    }
    return body;
  }

  function projectStatus(projectId: string): Promise<ActivityProjectStatus> {
    return statuses.get(projectId, async () => {
      const body = ActivityApiProjectStatusSchema.parse(
        await call(`/v1/projects/${encodeURIComponent(projectId)}/activity`, {
          method: "GET",
          headers: { accept: "application/json" },
        }),
      );
      return { ...body, activityUrl: activitySiteUrl(baseUrl) };
    });
  }

  async function trackedSourceId(projectId: string): Promise<string | null> {
    const status = await projectStatus(projectId);
    return status.status === "connected" || status.status === "tracked" ? status.sourceId : null;
  }

  return {
    async startSession(input: ActivityRegistrationInput) {
      const body = await call("/v1/binding-sessions", {
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
      });
      const session = ActivityApiBindingSessionSchema.safeParse(body);
      if (!session.success) {
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "Activity returned an unexpected response",
        });
      }
      return session.data;
    },

    projectStatus,

    async projectEvents(projectId: string, cursor?: string): Promise<ActivityProjectEvents> {
      const sourceId = await trackedSourceId(projectId);
      if (!sourceId) return { events: [], nextCursor: null };
      const page = await reader
        .listEvents({ source: sourceId, limit: PROJECT_EVENTS_PAGE_SIZE, cursor })
        .catch(() => {
          throw unavailable();
        });
      return {
        events: page.data.map((event) => ({
          id: event.id,
          type: event.type,
          actor: event.actor,
          occurredAt: event.timestamp,
          underReview: event.provenance?.approvalStatus === "pending",
        })),
        nextCursor: page.nextCursor,
      };
    },

    async projectContributors(projectId: string): Promise<ActivityProjectContributors> {
      const sourceId = await trackedSourceId(projectId);
      if (!sourceId) return [];
      const entries = await reader
        .leaderboard({ source: sourceId, period: "all-time", limit: PROJECT_CONTRIBUTORS_LIMIT })
        .catch(() => {
          throw unavailable();
        });
      return entries.map(({ rank, actor, score, eventCount }) => ({
        rank,
        actor,
        score,
        eventCount,
      }));
    },
  };
}

export type ActivityRegistrationClient = ReturnType<typeof createActivityRegistrationClient>;
