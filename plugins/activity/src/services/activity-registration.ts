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

export interface ActivityRegistrationClient {
  startSession(input: {
    projectId: string;
    nearAccountId?: string;
    eventTypes: ActivityRegistrationEventType[];
  }): Promise<{ url: string; expiresAt: string }>;
  projectStatus(projectId: string): Promise<ActivityProjectStatus>;
}

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
    },
  };
}
