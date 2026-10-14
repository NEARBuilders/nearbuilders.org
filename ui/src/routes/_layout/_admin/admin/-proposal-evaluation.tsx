import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CircleX,
  Loader2,
  type LucideIcon,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { ApiClient } from "@/app";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDateTime, type ProposalRecord } from "./-proposal-dashboard";

export type ProposalEvaluation = Awaited<
  ReturnType<ApiClient["getReviewEvaluations"]>
>["data"][number];

type Verdict = ProposalEvaluation["verdict"];
type CheckStatus = ProposalEvaluation["checks"][number]["status"];

const EVALUATIONS_QUERY_KEY = "admin-proposal-evaluations";
const MAX_IDS_PER_REQUEST = 200;

const VERDICTS: Record<
  Verdict,
  { label: string; variant: "success" | "secondary" | "destructive"; icon: LucideIcon }
> = {
  ready: { label: "Ready", variant: "success", icon: CircleCheck },
  review: { label: "Needs a look", variant: "secondary", icon: CircleAlert },
  spam: { label: "Likely spam", variant: "destructive", icon: CircleX },
};

const CHECK_STATUS: Record<CheckStatus, { icon: LucideIcon; className: string; label: string }> = {
  pass: { icon: CircleCheck, className: "text-brand-mint-foreground", label: "Passed" },
  warn: { icon: CircleAlert, className: "text-foreground", label: "Warning" },
  fail: { icon: CircleX, className: "text-destructive", label: "Failed" },
  skip: { icon: CircleMinus, className: "text-muted-foreground", label: "Skipped" },
};

export function currentEvaluation(
  evaluation: ProposalEvaluation | undefined,
  proposal: Pick<ProposalRecord, "submissionCount">,
): ProposalEvaluation | undefined {
  return evaluation && evaluation.submissionCount === proposal.submissionCount
    ? evaluation
    : undefined;
}

export function useProposalEvaluations(proposals: ProposalRecord[]) {
  const apiClient = useApiClient();
  const proposalIds = proposals
    .filter((proposal) => proposal.reviewStatus === "pending")
    .map((proposal) => proposal.id)
    .sort();
  const query = useQuery({
    queryKey: [EVALUATIONS_QUERY_KEY, proposalIds],
    queryFn: async () => {
      const chunks: string[][] = [];
      for (let index = 0; index < proposalIds.length; index += MAX_IDS_PER_REQUEST) {
        chunks.push(proposalIds.slice(index, index + MAX_IDS_PER_REQUEST));
      }
      const results = await Promise.all(
        chunks.map((chunk) => apiClient.getReviewEvaluations({ proposalIds: chunk })),
      );
      return results.flatMap((result) => result.data);
    },
    enabled: proposalIds.length > 0,
    staleTime: 30_000,
  });
  const byProposal = new Map<string, ProposalEvaluation>();
  for (const evaluation of query.data ?? []) byProposal.set(evaluation.proposalId, evaluation);
  return byProposal;
}

export function EvaluationBadge({ evaluation }: { evaluation: ProposalEvaluation | undefined }) {
  if (!evaluation) {
    return <span className="text-xs text-muted-foreground">Not evaluated</span>;
  }
  const verdict = VERDICTS[evaluation.verdict];
  const Icon = verdict.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={verdict.variant} className="cursor-default">
          <Icon />
          {verdict.label}
          {evaluation.score !== null && <span className="tabular-nums">{evaluation.score}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-xs leading-relaxed">
        {evaluation.summary}
      </TooltipContent>
    </Tooltip>
  );
}

export function EvaluationPanel({ proposal }: { proposal: ProposalRecord }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [EVALUATIONS_QUERY_KEY, [proposal.id]],
    queryFn: () => apiClient.getReviewEvaluations({ proposalIds: [proposal.id] }),
    staleTime: 30_000,
  });
  const reevaluate = useMutation({
    mutationFn: () =>
      apiClient.reevaluateProposal({ pluginId: proposal.pluginId, entityId: proposal.entityId }),
    onSuccess: async () => {
      toast.success("Evaluation updated");
      await queryClient.invalidateQueries({ queryKey: [EVALUATIONS_QUERY_KEY] });
    },
    onError: (error: Error) => toast.error(error.message || "The evaluation could not be updated"),
  });

  const stored = query.data?.data[0];
  const evaluation = currentEvaluation(stored, proposal);
  const outdated = Boolean(stored) && !evaluation;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {query.isLoading ? (
            <span className="text-xs text-muted-foreground">Loading evaluation...</span>
          ) : (
            <EvaluationBadge evaluation={evaluation} />
          )}
          {outdated && (
            <span className="text-xs text-muted-foreground">
              Resubmitted since the last evaluation
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => reevaluate.mutate()}
          disabled={reevaluate.isPending}
        >
          {reevaluate.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Re-evaluate
        </Button>
      </div>

      {evaluation && (
        <>
          <p className="text-sm leading-relaxed text-foreground">{evaluation.summary}</p>

          {evaluation.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {evaluation.flags.map((flag) => (
                <Badge key={flag} variant="outline" className="font-mono font-normal">
                  {flag}
                </Badge>
              ))}
            </div>
          )}

          <ul className="divide-y divide-border rounded-lg border border-border">
            {evaluation.checks.map((check) => {
              const status = CHECK_STATUS[check.status];
              const Icon = status.icon;
              return (
                <li key={check.id} className="flex items-start gap-2.5 px-3 py-2">
                  <Icon
                    className={cn("mt-0.5 size-4 shrink-0", status.className)}
                    aria-label={status.label}
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{check.label}</p>
                    {check.detail && (
                      <p className="break-words text-xs text-muted-foreground">{check.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-muted-foreground">
            {evaluation.model ? `Assessed by ${evaluation.model}` : "Automatic checks only"}
            {` · ${formatDateTime(evaluation.evaluatedAt)}`}
          </p>
        </>
      )}

      {!query.isLoading && !evaluation && !outdated && (
        <p className="text-sm text-muted-foreground">
          This item has not been evaluated yet. New submissions are evaluated within a few minutes.
        </p>
      )}
    </div>
  );
}
