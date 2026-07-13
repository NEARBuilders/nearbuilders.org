import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { catalogProjectQueryOptions } from "@/lib/queries/catalog";

type CatalogClaimReviewProposal = {
  entityId: string;
  payload: unknown;
  createdBy: string;
  reviewStatus: "pending" | "approved" | "rejected" | "removed";
  applyStatus?: "not_started" | "applied" | "failed";
  applyError?: string | null;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
};

function readClaimPayload(payload: unknown) {
  const value =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  return {
    nearAccount: typeof value.nearAccount === "string" ? value.nearAccount : null,
    projectSlug: typeof value.projectSlug === "string" ? value.projectSlug : null,
    roles: Array.isArray(value.roles)
      ? value.roles.filter((role): role is string => typeof role === "string")
      : [],
  };
}

export function CatalogClaimReviewCard({ proposal }: { proposal: CatalogClaimReviewProposal }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const claim = useMemo(() => readClaimPayload(proposal.payload), [proposal.payload]);
  const nearAccount = claim.nearAccount ?? proposal.createdBy;
  const projectQuery = useQuery({
    ...catalogProjectQueryOptions(apiClient, claim.projectSlug ?? ""),
    enabled: Boolean(claim.projectSlug),
  });
  const builderQuery = useQuery({
    queryKey: ["admin-catalog-claim-builder", nearAccount],
    queryFn: () => apiClient.getBuilder({ nearAccount }),
    retry: false,
  });
  const auditQuery = useQuery({
    queryKey: ["admin-catalog-claim-audit", proposal.entityId],
    queryFn: () =>
      apiClient.getAuditLog({ pluginId: "nearcatalog", entityId: proposal.entityId, limit: 20 }),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", "nearcatalog"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-claim-proposals"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-claims"] }),
    ]);
  };
  const approveMutation = useMutation({
    mutationFn: () => apiClient.approve({ pluginId: "nearcatalog", entityId: proposal.entityId }),
    onSuccess: async () => {
      toast.success("Catalog contribution approved");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Could not approve contribution"),
  });
  const rejectMutation = useMutation({
    mutationFn: () =>
      apiClient.reject({
        pluginId: "nearcatalog",
        entityId: proposal.entityId,
        reason: rejectionReason.trim() || undefined,
      }),
    onSuccess: async () => {
      setShowRejectForm(false);
      toast.success("Catalog contribution rejected");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Could not reject contribution"),
  });
  const revokeMutation = useMutation({
    mutationFn: () => apiClient.remove({ pluginId: "nearcatalog", entityId: proposal.entityId }),
    onSuccess: async () => {
      toast.success("Catalog contribution revoked");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Could not revoke contribution"),
  });

  const project = projectQuery.data?.data;
  const builder = builderQuery.data?.data;
  const canReview = proposal.reviewStatus === "pending" || proposal.applyStatus === "failed";
  const isBusy = approveMutation.isPending || rejectMutation.isPending || revokeMutation.isPending;

  if (claim.projectSlug && projectQuery.isPending) {
    return (
      <article className="rounded-xl border border-border bg-card p-5" aria-label="Loading project">
        <div className="flex items-start gap-3">
          <Skeleton className="size-14 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {project?.imageUrl ? (
            <img
              src={project.imageUrl}
              alt=""
              className="size-14 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary font-semibold text-secondary-foreground">
              {(project?.name ?? claim.projectSlug ?? "N").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-foreground">
                {project?.name ?? claim.projectSlug ?? "Catalog project"}
              </h2>
              <Badge variant="outline">NearCatalog</Badge>
              {proposal.applyStatus === "failed" && (
                <Badge variant="destructive">Apply failed</Badge>
              )}
            </div>
            {project?.tagline && (
              <p className="mt-1 text-sm text-muted-foreground">{project.tagline}</p>
            )}
            <div className="mt-2 text-sm text-foreground">
              <span className="font-semibold">{builder?.name ?? nearAccount}</span>
              <span className="text-muted-foreground"> · {nearAccount}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {project?.catalogUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={project.catalogUrl} target="_blank" rel="noopener noreferrer">
                Catalog
                <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
          {canReview ? (
            <>
              <Button size="sm" onClick={() => approveMutation.mutate()} disabled={isBusy}>
                {approveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : proposal.applyStatus === "failed" ? (
                  <RotateCcw className="size-4" />
                ) : (
                  <Check className="size-4" />
                )}
                {proposal.applyStatus === "failed" ? "Retry approval" : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRejectForm((value) => !value)}
                disabled={isBusy}
              >
                <X className="size-4" />
                Reject
              </Button>
            </>
          ) : proposal.reviewStatus === "approved" && proposal.applyStatus === "applied" ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => revokeMutation.mutate()}
              disabled={isBusy}
            >
              {revokeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Revoke
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {claim.roles.map((role) => (
          <Badge key={role} variant="secondary">
            {role}
          </Badge>
        ))}
      </div>
      {proposal.applyError && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {proposal.applyError}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{proposal.submissionCount} submissions</span>
        <span>Submitted {new Date(proposal.createdAt).toLocaleDateString()}</span>
        <span>Updated {new Date(proposal.updatedAt).toLocaleDateString()}</span>
      </div>
      {(auditQuery.data?.data.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {auditQuery.data?.data.slice(0, 6).map((entry) => (
            <Badge key={entry.id} variant="outline" className="font-normal">
              {entry.action.replaceAll("_", " ")}
            </Badge>
          ))}
        </div>
      )}
      {showRejectForm && (
        <div className="mt-4 space-y-2">
          <Textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Reason for rejection (optional)"
            maxLength={1000}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending}
          >
            {rejectMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Confirm rejection
          </Button>
        </div>
      )}
    </article>
  );
}
