import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import { type CheckDependencies, runReviewChecks } from "./review-checks";
import { type Assessor, combineEvaluation, EVALUATION_PROMPT_VERSION } from "./review-evaluation";

type ProposalRecord = z.infer<typeof ProposalSchema>;
type SweepPlugins = Pick<PluginsClient, "proposals" | "projects" | "builders" | "events">;

export type SweepResult = {
  evaluated: number;
  failed: number;
  pending: number;
  skipped?: "lease_held";
};

const LEASE_NAME = "evaluation-sweep";
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewEvaluationSweep = {
  runOnce: () => Promise<SweepResult>;
  evaluateOne: (target: {
    pluginId: string;
    entityId: string;
  }) => Promise<Awaited<ReturnType<ReturnType<SweepPlugins["proposals"]>["recordEvaluation"]>>>;
  start: () => void;
  stop: () => void;
};

const EVALUATED_PLUGIN_IDS = new Set(["builders", "projects", "events", "nearcatalog"]);
const DEFAULT_ASSESSMENT_RETRY_MS = 30 * 60 * 1000;

type ExistingEvaluation = {
  proposalId: string;
  submissionCount: number;
  model: string | null;
  evaluatedAt: string;
  promptVersion?: string;
};

export function needsEvaluation(
  proposal: Pick<ProposalRecord, "id" | "submissionCount">,
  existing: ExistingEvaluation | undefined,
  options: { canAssess: boolean; now: number; retryAfterMs: number },
): boolean {
  if (!existing || existing.submissionCount !== proposal.submissionCount) return true;
  if (
    options.canAssess &&
    existing.model !== null &&
    existing.promptVersion !== EVALUATION_PROMPT_VERSION
  ) {
    return true;
  }
  if (!options.canAssess || existing.model !== null) return false;
  return options.now - Date.parse(existing.evaluatedAt) >= options.retryAfterMs;
}
const MAX_PAGES = 5;
const FIRST_RUN_DELAY_MS = 15_000;

export const REVIEW_EVALUATOR = Symbol.for("nearbuilders.proposals.reviewEvaluator");

export const evaluatorContext = { [REVIEW_EVALUATOR]: true } as unknown as Context;

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

export function createCheckDependencies(
  plugins: SweepPlugins,
  options: { githubToken?: string; now?: () => number },
): CheckDependencies {
  return {
    now: options.now?.() ?? Date.now(),
    fetch,
    githubToken: options.githubToken || undefined,
    lookupHost: async (hostname) =>
      (await lookup(hostname, { all: true })).map((entry) => entry.address),
    nearRpcUrl: (accountId) =>
      accountId.endsWith(".testnet")
        ? "https://rpc.testnet.fastnear.com"
        : "https://rpc.mainnet.fastnear.com",
    findDuplicateProject: async ({ entityId, title, slug, repository }) => {
      const query = title ?? slug;
      if (!query) return null;
      const result = await plugins
        .projects(evaluatorContext)
        .listProjects({ query: query.slice(0, 200), limit: 20 });
      const match = result.data.find(
        (project) =>
          project.id !== entityId &&
          (sameText(project.title, title) ||
            sameText(project.slug, slug) ||
            sameText(project.repository, repository)),
      );
      return match ? match.title : null;
    },
    findBuilderWithSameName: async ({ nearAccount, name }) => {
      const result = await plugins
        .builders(evaluatorContext)
        .listBuilders({ search: name.slice(0, 100), limit: 20 });
      const match = result.data.find(
        (builder) =>
          builder.nearAccount !== nearAccount &&
          !builder.withdrawnAt &&
          sameText(builder.name, name),
      );
      return match ? match.nearAccount : null;
    },
    findDuplicateEvent: async ({ entityId, title, startAt }) => {
      const result = await plugins.events(evaluatorContext).listEvents({ limit: 100 });
      const match = result.data.find(
        (event) =>
          event.id !== entityId &&
          sameText(event.title, title) &&
          Math.abs(Date.parse(event.startAt) - startAt) < DAY_MS,
      );
      return match ? match.title : null;
    },
    hasBuilderProfile: async (nearAccount) => {
      try {
        const result = await plugins.builders(evaluatorContext).getBuilder({ nearAccount });
        return !result.data.withdrawnAt;
      } catch (error) {
        if (error instanceof ORPCError && error.code === "NOT_FOUND") return false;
        return null;
      }
    },
  };
}

async function loadSubmissionSource(
  plugins: SweepPlugins,
  proposal: Pick<ProposalRecord, "pluginId" | "entityId">,
): Promise<string | null> {
  try {
    const result = await plugins.proposals(evaluatorContext).getSubmissions({
      pluginId: proposal.pluginId,
      entityId: proposal.entityId,
      limit: 1,
    });
    return result.data[0]?.source ?? null;
  } catch {
    return null;
  }
}

async function loadPendingProposals(plugins: SweepPlugins): Promise<ProposalRecord[]> {
  const client = plugins.proposals(evaluatorContext);
  const proposals: ProposalRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await client.getProposals({ reviewStatus: "pending", limit: 100, cursor });
    proposals.push(...result.data);
    if (!result.meta.hasMore || !result.meta.nextCursor) break;
    cursor = result.meta.nextCursor;
  }
  return proposals.filter((proposal) => EVALUATED_PLUGIN_IDS.has(proposal.pluginId));
}

export function createReviewEvaluationSweep(options: {
  plugins: SweepPlugins;
  assessor: Assessor | null;
  githubToken?: string;
  intervalMs: number;
  batchSize: number;
  assessmentRetryMs?: number;
  now?: () => number;
  checkDependencies?: () => CheckDependencies;
  log?: (message: string, details?: Record<string, unknown>) => void;
}): ReviewEvaluationSweep {
  const log = options.log ?? ((message, details) => console.log(message, details ?? ""));
  let running = false;
  const holder = `sweep-${randomUUID()}`;
  const leaseTtlMs = Math.max(options.intervalMs * 2, 60_000);
  let firstRun: ReturnType<typeof setTimeout> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;

  const evaluateProposal = async (proposal: ProposalRecord) => {
    const deps =
      options.checkDependencies?.() ??
      createCheckDependencies(options.plugins, {
        githubToken: options.githubToken,
        now: options.now,
      });
    const source = await loadSubmissionSource(options.plugins, proposal);
    const subject = {
      pluginId: proposal.pluginId,
      entityId: proposal.entityId,
      createdBy: proposal.createdBy,
      payload: proposal.payload,
      source,
    };
    const checks = await runReviewChecks(subject, deps);
    const assessment = options.assessor
      ? await options.assessor.assess({ subject, checks }).catch((error: unknown) => {
          log("[ReviewEvaluation] Assessment failed", {
            proposalId: proposal.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        })
      : null;
    const result = combineEvaluation(
      checks,
      assessment,
      assessment ? (options.assessor?.model ?? null) : null,
    );
    return await options.plugins.proposals(evaluatorContext).recordEvaluation({
      pluginId: proposal.pluginId,
      entityId: proposal.entityId,
      submissionCount: proposal.submissionCount,
      source,
      ...result,
    });
  };

  const evaluateOne = async (target: { pluginId: string; entityId: string }) => {
    const result = await options.plugins
      .proposals(evaluatorContext)
      .getProposals({ pluginId: target.pluginId, entityId: target.entityId, limit: 1 });
    const proposal = result.data[0];
    if (!proposal) throw new ORPCError("NOT_FOUND", { message: "Proposal not found" });
    return await evaluateProposal(proposal);
  };

  const runOnce = async (): Promise<SweepResult> => {
    if (running) return { evaluated: 0, failed: 0, pending: 0 };
    running = true;
    try {
      const lease = await options.plugins
        .proposals(evaluatorContext)
        .acquireReviewLease({ name: LEASE_NAME, holder, ttlMs: leaseTtlMs });
      if (!lease.acquired) return { evaluated: 0, failed: 0, pending: 0, skipped: "lease_held" };
      const proposals = await loadPendingProposals(options.plugins);
      const existing = await options.plugins
        .proposals(evaluatorContext)
        .getEvaluations({ proposalIds: proposals.map((proposal) => proposal.id) });
      const evaluations = new Map(
        existing.data.map((evaluation) => [evaluation.proposalId, evaluation]),
      );
      const now = options.now?.() ?? Date.now();
      const due = proposals
        .filter((proposal) =>
          needsEvaluation(proposal, evaluations.get(proposal.id), {
            canAssess: options.assessor !== null,
            now,
            retryAfterMs: options.assessmentRetryMs ?? DEFAULT_ASSESSMENT_RETRY_MS,
          }),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      let evaluated = 0;
      let failed = 0;
      for (const proposal of due.slice(0, options.batchSize)) {
        try {
          await evaluateProposal(proposal);
          evaluated += 1;
        } catch (error) {
          failed += 1;
          log("[ReviewEvaluation] Evaluation failed", {
            proposalId: proposal.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (evaluated > 0 || failed > 0) {
        log("[ReviewEvaluation] Sweep finished", { evaluated, failed, due: due.length });
      }
      return { evaluated, failed, pending: Math.max(0, due.length - evaluated - failed) };
    } finally {
      running = false;
    }
  };

  const tick = () => {
    runOnce().catch((error: unknown) =>
      log("[ReviewEvaluation] Sweep crashed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  };

  return {
    runOnce,
    evaluateOne,
    start: () => {
      if (interval || firstRun) return;
      if (typeof options.plugins.proposals !== "function") {
        log("[ReviewEvaluation] Proposals plugin unavailable; sweep not started");
        return;
      }
      firstRun = setTimeout(tick, FIRST_RUN_DELAY_MS);
      interval = setInterval(tick, options.intervalMs);
      firstRun.unref?.();
      interval.unref?.();
    },
    stop: () => {
      if (firstRun) clearTimeout(firstRun);
      if (interval) clearInterval(interval);
      firstRun = undefined;
      interval = undefined;
    },
  };
}
