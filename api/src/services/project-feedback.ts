import { ORPCError } from "@orpc/client";
import { z } from "zod";
import type { ProjectFeedbackSchema } from "../contract";
import type { PluginEntries } from "../lib/plugin-clients";

export type ProjectFeedback = z.infer<typeof ProjectFeedbackSchema>;

export type ProjectFeedbackRpcClient = ReturnType<PluginEntries["feedback"]["client"]>;

const FeedbackProjectDetailSchema = z.object({
  slug: z.string(),
  rounds: z.array(
    z.object({
      title: z.string(),
      status: z.string(),
      projectRoundNumber: z.number().int().positive(),
      endsAt: z.string().nullable(),
    }),
  ),
});

function feedbackUrls(baseUrl: string, slug: string) {
  const request = new URL("/manage/new", baseUrl);
  request.searchParams.set("project", slug);
  return {
    requestUrl: request.toString(),
    projectUrl: new URL(`/projects/${encodeURIComponent(slug)}`, baseUrl).toString(),
    roundUrl: (number: number) =>
      new URL(`/projects/${encodeURIComponent(slug)}/${number}`, baseUrl).toString(),
  };
}

export function projectFeedbackFromDetail(
  detail: z.infer<typeof FeedbackProjectDetailSchema>,
  baseUrl: string,
  now: number,
): ProjectFeedback {
  const urls = feedbackUrls(baseUrl, detail.slug);
  const isOpen = (round: (typeof detail.rounds)[number]) =>
    round.status === "open" && (!round.endsAt || Date.parse(round.endsAt) > now);
  const open = detail.rounds
    .filter(isOpen)
    .sort((a, b) => b.projectRoundNumber - a.projectRoundNumber)[0];
  const pastRounds = detail.rounds.filter(
    (round) => round.status === "closed" || (round.status === "open" && !isOpen(round)),
  ).length;
  if (open) {
    const url = urls.roundUrl(open.projectRoundNumber);
    return {
      status: "open",
      openRound: {
        number: open.projectRoundNumber,
        title: open.title,
        endsAt: open.endsAt,
        url,
      },
      pastRounds,
      feedbackUrl: url,
      requestUrl: urls.requestUrl,
    };
  }
  return {
    status: "registered",
    openRound: null,
    pastRounds,
    feedbackUrl: urls.projectUrl,
    requestUrl: urls.requestUrl,
  };
}

export function createProjectFeedbackClient(options: {
  client?: ProjectFeedbackRpcClient;
  feedbackBaseUrl: string;
  cacheMs?: number;
  failureCacheMs?: number;
  maxEntries?: number;
  now?: () => number;
}) {
  const baseUrl = options.feedbackBaseUrl.replace(/\/+$/, "");
  const cacheMs = options.cacheMs ?? 60_000;
  const failureCacheMs = options.failureCacheMs ?? 10_000;
  const maxEntries = options.maxEntries ?? 1_000;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { expiresAt: number; value: Promise<ProjectFeedback> }>();

  function withoutRound(slug: string, status: "none" | "unknown"): ProjectFeedback {
    const { requestUrl } = feedbackUrls(baseUrl, slug);
    return { status, openRound: null, pastRounds: 0, feedbackUrl: requestUrl, requestUrl };
  }

  async function load(slug: string): Promise<ProjectFeedback> {
    if (!options.client) return withoutRound(slug, "unknown");
    try {
      const detail = await options.client.getProjectBySlug({ slug });
      const parsed = FeedbackProjectDetailSchema.safeParse(detail);
      if (!parsed.success) return withoutRound(slug, "unknown");
      return projectFeedbackFromDetail(parsed.data, baseUrl, now());
    } catch (error) {
      if (error instanceof ORPCError && error.code === "NOT_FOUND") {
        return withoutRound(slug, "none");
      }
      return withoutRound(slug, "unknown");
    }
  }

  return {
    lookup(slug: string): Promise<ProjectFeedback> {
      const hit = cache.get(slug);
      if (hit && hit.expiresAt > now()) return hit.value;
      const value = load(slug);
      cache.delete(slug);
      const entry = { expiresAt: now() + cacheMs, value };
      cache.set(slug, entry);
      void value.then((result) => {
        if (result.status === "unknown") entry.expiresAt = now() + failureCacheMs;
      });
      while (cache.size > maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      return value;
    },
  };
}

export type ProjectFeedbackClient = ReturnType<typeof createProjectFeedbackClient>;
