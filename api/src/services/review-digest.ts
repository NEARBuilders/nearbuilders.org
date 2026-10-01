import type { z } from "every-plugin/zod";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import { readString, readStringArray } from "../lib/utils";

type ProposalRecord = z.infer<typeof ProposalSchema>;

export const REVIEW_DIGEST_PLUGIN_IDS = ["builders", "projects", "events", "nearcatalog"] as const;

export type ReviewDigestPluginId = (typeof REVIEW_DIGEST_PLUGIN_IDS)[number];
export type ReviewDigestItemState = "pending" | "apply_failed" | "remove_failed" | "stalled";

export type ReviewDigestItem = {
  id: string;
  pluginId: ReviewDigestPluginId;
  entityId: string;
  title: string;
  submittedBy: string;
  detail: string | null;
  submissionCount: number;
  evaluation: ReviewDigestEvaluation | null;
  state: ReviewDigestItemState;
  createdAt: string;
  ageDays: number;
  isNew: boolean;
  isStale: boolean;
  dashboardPath: string;
};

export type ReviewDigestEvaluation = {
  verdict: "ready" | "review" | "spam";
  score: number | null;
  summary: string;
  flags: string[];
  source: string | null;
};

export type StoredEvaluation = Omit<ReviewDigestEvaluation, "source"> & {
  proposalId: string;
  submissionCount: number;
  source?: string | null;
};

export type ReviewWindow = { reviewed: number; medianWaitDays: number | null };

export type ReviewDigestActivity = {
  last24h: { approved: number; rejected: number };
  last7d: ReviewWindow;
  previous7d: ReviewWindow;
};

export type ReviewHistoryEntry = {
  pluginId: string;
  action: "approved" | "rejected";
  createdAt: string;
  proposal: { createdAt: string };
};

export type ReviewDigest = {
  generatedAt: string;
  staleAfterDays: number;
  totals: {
    pending: number;
    newLast24h: number;
    stale: number;
    needsAttention: number;
    oldestPendingDays: number | null;
  };
  byPlugin: Record<ReviewDigestPluginId, number>;
  activity: ReviewDigestActivity;
  items: ReviewDigestItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFECYCLE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_PAGES = 10;

const DASHBOARD_TABS: Record<ReviewDigestPluginId, string> = {
  builders: "builders",
  projects: "projects",
  events: "events",
  nearcatalog: "activity",
};

function isDigestPluginId(value: string): value is ReviewDigestPluginId {
  return (REVIEW_DIGEST_PLUGIN_IDS as readonly string[]).includes(value);
}

function readPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

export function reviewDigestTitle(
  proposal: Pick<ProposalRecord, "pluginId" | "entityId" | "payload">,
) {
  const payload = readPayload(proposal.payload);
  const title =
    proposal.pluginId === "builders"
      ? readString(payload.name)
      : proposal.pluginId === "nearcatalog"
        ? (readString(payload.projectName) ?? readString(payload.projectSlug))
        : readString(payload.title);
  return (title ?? proposal.entityId).trim().slice(0, 120);
}

export function reviewDigestDetail(
  proposal: Pick<ProposalRecord, "pluginId" | "payload">,
): string | null {
  const payload = readPayload(proposal.payload);
  const detail =
    proposal.pluginId === "builders"
      ? (readString(payload.location) ??
        (readStringArray(payload.skills) ?? []).slice(0, 2).join(", "))
      : proposal.pluginId === "projects"
        ? (readString(payload.repository) ?? readString(payload.domain))
        : proposal.pluginId === "events"
          ? readString(payload.location)
          : (readStringArray(payload.roles) ?? []).join(", ");
  const trimmed = detail?.trim().slice(0, 80);
  return trimmed ? trimmed : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
  return Math.round(value * 10) / 10;
}

export function buildReviewActivity(
  history: ReviewHistoryEntry[],
  now: number,
): ReviewDigestActivity {
  const last24h = { approved: 0, rejected: 0 };
  const last7d: number[] = [];
  const previous7d: number[] = [];
  for (const entry of history) {
    if (!isDigestPluginId(entry.pluginId)) continue;
    const decidedAt = new Date(entry.createdAt).getTime();
    const age = now - decidedAt;
    if (age < 0 || age >= 14 * DAY_MS) continue;
    if (age < DAY_MS) last24h[entry.action] += 1;
    const waitDays = Math.max(0, decidedAt - new Date(entry.proposal.createdAt).getTime()) / DAY_MS;
    (age < 7 * DAY_MS ? last7d : previous7d).push(waitDays);
  }
  return {
    last24h,
    last7d: { reviewed: last7d.length, medianWaitDays: median(last7d) },
    previous7d: { reviewed: previous7d.length, medianWaitDays: median(previous7d) },
  };
}

function currentEvaluation(
  evaluation: StoredEvaluation | undefined,
  submissionCount: number,
): ReviewDigestEvaluation | null {
  if (!evaluation || evaluation.submissionCount !== submissionCount) return null;
  return {
    verdict: evaluation.verdict,
    score: evaluation.score,
    summary: evaluation.summary,
    flags: evaluation.flags,
    source: evaluation.source ?? null,
  };
}

export function reviewDigestState(
  proposal: Pick<ProposalRecord, "reviewStatus" | "applyStatus" | "removeStatus" | "updatedAt">,
  now: number,
): ReviewDigestItemState | null {
  if (proposal.reviewStatus === "pending") return "pending";
  if (proposal.applyStatus === "failed") return "apply_failed";
  if (proposal.removeStatus === "failed") return "remove_failed";
  const inProgress = proposal.applyStatus === "applying" || proposal.removeStatus === "removing";
  if (inProgress && now - new Date(proposal.updatedAt).getTime() >= LIFECYCLE_TIMEOUT_MS) {
    return "stalled";
  }
  return null;
}

export function buildReviewDigest(
  proposals: ProposalRecord[],
  options: {
    now: number;
    staleAfterDays: number;
    history?: ReviewHistoryEntry[];
    evaluations?: StoredEvaluation[];
  },
): ReviewDigest {
  const evaluations = new Map(
    (options.evaluations ?? []).map((evaluation) => [evaluation.proposalId, evaluation]),
  );
  const byPlugin: Record<ReviewDigestPluginId, number> = {
    builders: 0,
    projects: 0,
    events: 0,
    nearcatalog: 0,
  };
  const items: ReviewDigestItem[] = [];

  for (const proposal of proposals) {
    if (!isDigestPluginId(proposal.pluginId)) continue;
    const state = reviewDigestState(proposal, options.now);
    if (!state) continue;

    const ageMs = Math.max(0, options.now - new Date(proposal.createdAt).getTime());
    const ageDays = Math.floor(ageMs / DAY_MS);
    const pending = state === "pending";
    if (pending) byPlugin[proposal.pluginId] += 1;

    const params = new URLSearchParams({ item: proposal.entityId });
    if (pending) params.set("status", "pending");

    items.push({
      id: proposal.id,
      pluginId: proposal.pluginId,
      entityId: proposal.entityId,
      title: reviewDigestTitle(proposal),
      submittedBy: proposal.createdBy,
      detail: reviewDigestDetail(proposal),
      submissionCount: proposal.submissionCount,
      evaluation: currentEvaluation(evaluations.get(proposal.id), proposal.submissionCount),
      state,
      createdAt: proposal.createdAt,
      ageDays,
      isNew: pending && ageMs < DAY_MS,
      isStale: pending && ageDays >= options.staleAfterDays,
      dashboardPath: `/admin/dashboard/${DASHBOARD_TABS[proposal.pluginId]}?${params.toString()}`,
    });
  }

  items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pendingItems = items.filter((item) => item.state === "pending");

  return {
    generatedAt: new Date(options.now).toISOString(),
    staleAfterDays: options.staleAfterDays,
    totals: {
      pending: pendingItems.length,
      newLast24h: pendingItems.filter((item) => item.isNew).length,
      stale: pendingItems.filter((item) => item.isStale).length,
      needsAttention: items.length - pendingItems.length,
      oldestPendingDays: pendingItems[0]?.ageDays ?? null,
    },
    byPlugin,
    activity: buildReviewActivity(options.history ?? [], options.now),
    items,
  };
}

export async function loadReviewDigest(
  plugins: Pick<PluginsClient, "proposals">,
  context: Context,
  options: { now?: number; staleAfterDays: number },
): Promise<ReviewDigest> {
  const proposalsClient = plugins.proposals(context);
  const proposals: ProposalRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await proposalsClient.getProposals({
      lifecycleStatus: "actionable",
      limit: 100,
      cursor,
    });
    proposals.push(...result.data);
    if (!result.meta.hasMore || !result.meta.nextCursor) break;
    cursor = result.meta.nextCursor;
  }
  const now = options.now ?? Date.now();
  const history: ReviewHistoryEntry[] = [];
  cursor = undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await proposalsClient.getReviewHistory({ limit: 100, cursor });
    history.push(...result.data);
    const oldest = result.data.at(-1);
    if (oldest && now - new Date(oldest.createdAt).getTime() >= 14 * DAY_MS) break;
    if (!result.meta.hasMore || !result.meta.nextCursor) break;
    cursor = result.meta.nextCursor;
  }
  const evaluations = await proposalsClient
    .getEvaluations({ proposalIds: proposals.map((proposal) => proposal.id) })
    .then((result) => result.data as StoredEvaluation[])
    .catch((error: unknown) => {
      console.error("[ReviewDigest] Could not load evaluations:", error);
      return [];
    });
  return buildReviewDigest(proposals, {
    now,
    staleAfterDays: options.staleAfterDays,
    history,
    evaluations,
  });
}
