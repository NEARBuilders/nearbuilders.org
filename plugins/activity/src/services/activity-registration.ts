import { ORPCError } from "@orpc/server";
import type { z } from "zod";
import type {
  ActivityProjectContributorsSchema,
  ActivityProjectEventsSchema,
  ActivityProjectStatusSchema,
  ActivityRegistrationInputSchema,
} from "../contract";
import { activityErrorStatus, activitySiteUrl, createActivitySourceClient } from "./activity-api";
import type { ActivityReaderClient } from "./activity-reader";
import { createTtlCache } from "./ttl-cache";

type ActivityRegistrationInput = z.infer<typeof ActivityRegistrationInputSchema>;
type ActivityProjectStatus = z.infer<typeof ActivityProjectStatusSchema>;
type ActivityProjectEvents = z.infer<typeof ActivityProjectEventsSchema>;
type ActivityProjectContributors = z.infer<typeof ActivityProjectContributorsSchema>;

const PROJECT_EVENTS_PAGE_SIZE = 10;
const PROJECT_CONTRIBUTORS_LIMIT = 5;

function unavailable(): ORPCError<"SERVICE_UNAVAILABLE", unknown> {
  return new ORPCError("SERVICE_UNAVAILABLE", {
    message: "Activity could not be reached. Try again shortly.",
  });
}

function fromActivityError(error: unknown): ORPCError<string, unknown> {
  const status = activityErrorStatus(error);
  if (status === null) return unavailable();
  return new ORPCError(status >= 500 ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST", {
    message:
      error instanceof Error && error.message ? error.message : `Activity returned ${status}`,
  });
}

export function createActivityRegistrationClient(options: {
  baseUrl: string;
  apiKey: string;
  reader: Pick<ActivityReaderClient, "listEvents" | "leaderboard" | "projectActivity">;
  timeoutMs?: number;
  statusCacheMs?: number;
}) {
  const reader = options.reader;
  const client = createActivitySourceClient(options);
  const timeoutMs = options.timeoutMs ?? 10_000;
  const activityUrl = activitySiteUrl(options.baseUrl);
  const statuses = createTtlCache<ActivityProjectStatus>({
    ttlMs: options.statusCacheMs ?? 30_000,
    maxEntries: 1_000,
  });

  function projectStatus(projectId: string): Promise<ActivityProjectStatus> {
    return statuses.get(projectId, async () => {
      const body = await reader.projectActivity(projectId).catch((error: unknown) => {
        throw fromActivityError(error);
      });
      return {
        status: body.status,
        sourceId: body.sourceId,
        displayName: body.displayName,
        reviewReason: body.reviewReason,
        activityUrl,
      };
    });
  }

  async function trackedSourceId(projectId: string): Promise<string | null> {
    const status = await projectStatus(projectId);
    return status.status === "connected" || status.status === "tracked" ? status.sourceId : null;
  }

  return {
    async startSession(input: ActivityRegistrationInput) {
      const session = await client
        .createActivityBindingSession(
          {
            project: { id: input.projectId },
            ...(input.nearAccountId && { nearAccountId: input.nearAccountId }),
            eventTypes: input.eventTypes.map(({ name, pointValue }) => ({
              name,
              description: "",
              enabled: true,
              pointValue,
            })),
          },
          { signal: AbortSignal.timeout(timeoutMs) },
        )
        .catch((error: unknown) => {
          throw fromActivityError(error);
        });
      return { url: session.url, expiresAt: session.expiresAt };
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
