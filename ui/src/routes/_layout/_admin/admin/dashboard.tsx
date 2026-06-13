import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, FileText, Hammer, Loader2, MapPin, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard")({
  head: () => ({
    meta: [{ title: "Admin Dashboard | NEAR Builders" }],
  }),
  component: AdminDashboard,
});

type ProposalStatus = "pending" | "approved" | "rejected" | "removed";

interface ProposalRecord {
  id: string;
  pluginId: "builders" | "projects";
  entityId: string;
  payload: unknown;
  reviewStatus: ProposalStatus;
  rejectionReason: string | null;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

function readPayload(payload: unknown) {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function AdminDashboard() {
  const [pluginTab, setPluginTab] = useState<"builders" | "projects">("builders");
  const apiClient = useApiClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-proposals", pluginTab],
    queryFn: () =>
      apiClient.getProposals({
        pluginId: pluginTab,
        reviewStatus: "pending",
        limit: 50,
      }),
  });

  const proposals = (data?.data ?? []) as ProposalRecord[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-black tracking-tight text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Review builder and project proposals.</p>
      </div>

      <div className="mb-6 flex gap-1">
        {(
          [
            ["builders", "Builders"],
            ["projects", "Projects"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPluginTab(value)}
            className={`h-8 rounded-xl border px-3 text-sm font-semibold transition-all duration-150 ${
              pluginTab === value
                ? "border-brand-accent bg-brand-accent-light text-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProposalReviewCardSkeleton key={i} />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">No pending proposals</p>
          <p className="mt-1 text-xs text-muted-foreground">All caught up for {pluginTab}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {proposals.length} proposal{proposals.length !== 1 ? "s" : ""} pending review
          </p>
          {proposals.map((proposal) => (
            <ProposalReviewCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalReviewCard({ proposal }: { proposal: ProposalRecord }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const payload = useMemo(() => readPayload(proposal.payload), [proposal.payload]);

  const title =
    proposal.pluginId === "builders"
      ? (readString(payload.name) ?? proposal.entityId)
      : (readString(payload.title) ?? proposal.entityId);

  const approveMutation = useMutation({
    mutationFn: () =>
      apiClient.approve({ pluginId: proposal.pluginId, entityId: proposal.entityId }),
    onSuccess: () => {
      toast.success(`${title} approved`);
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", proposal.pluginId] });
      queryClient.invalidateQueries({ queryKey: ["my-builder-profile"] });
      queryClient.invalidateQueries({ queryKey: ["builder-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiClient.reject({
        pluginId: proposal.pluginId,
        entityId: proposal.entityId,
        reason: rejectReason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`${title} rejected`);
      setShowRejectForm(false);
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", proposal.pluginId] });
      queryClient.invalidateQueries({ queryKey: ["builder-proposals"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to reject"),
  });

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
        {proposal.pluginId === "builders" ? (
          <Hammer className="size-5 text-muted-foreground" />
        ) : (
          <FileText className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-foreground">{title}</span>
              <Badge variant="secondary" className="rounded-full text-[10px] uppercase">
                {proposal.pluginId}
              </Badge>
            </div>
            <div className="mt-0.5 text-xs font-mono text-brand-cyan">{proposal.entityId}</div>
            {proposal.pluginId === "builders" && readString(payload.location) && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={10} />
                {readString(payload.location)}
              </div>
            )}
            {proposal.pluginId === "projects" && readString(payload.slug) && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                /{readString(payload.slug)}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="bg-brand-green text-black hover:bg-brand-green/90"
            >
              {approveMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRejectForm((value) => !value)}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <X size={13} />
              Reject
            </Button>
          </div>
        </div>

        {proposal.pluginId === "builders" ? (
          <>
            {readString(payload.bio) && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {readString(payload.bio)}
              </p>
            )}
            {readStringArray(payload.skills).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {readStringArray(payload.skills).map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="rounded-full px-2 py-0.5 text-xs"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {readString(payload.description) && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {readString(payload.description)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {readString(payload.kind) && (
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs capitalize">
                  {readString(payload.kind)}
                </Badge>
              )}
              {readString(payload.visibility) && (
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs capitalize">
                  {readString(payload.visibility)}
                </Badge>
              )}
            </div>
          </>
        )}

        <div className="mt-3 text-[10px] text-muted-foreground/60">
          {proposal.submissionCount} nomination{proposal.submissionCount !== 1 ? "s" : ""} ·
          Submitted {new Date(proposal.createdAt).toLocaleDateString()}
        </div>

        {showRejectForm && (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              maxLength={1000}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
                Confirm rejection
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalReviewCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card p-5">
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}
