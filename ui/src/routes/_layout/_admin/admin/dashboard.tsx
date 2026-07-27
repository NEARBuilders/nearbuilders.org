import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart2,
  CalendarDays,
  Check,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  Globe,
  Hammer,
  History,
  Layers,
  Loader2,
  Lock,
  MapPin,
  RotateCcw,
  UserRound,
  X,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { CatalogClaimReviewCard } from "@/components/catalog-claim-review-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { exportProjectProposals } from "@/lib/export-csv";
import { ensureCatalogProjects } from "@/lib/queries/catalog";
import { fetchRepositoryReadme } from "@/lib/repository-content";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard")({
  head: () => ({
    meta: [{ title: "Admin Dashboard | NEAR Builders" }],
  }),
  component: AdminDashboard,
});

type ProposalStatus = "pending" | "approved" | "rejected" | "removed";
type ProposalPluginId = "builders" | "projects" | "events" | "nearcatalog";
type DashboardView = "pending" | "history";

const PROPOSAL_TABS = [
  ["builders", "Builders"],
  ["projects", "Projects"],
  ["events", "Events"],
  ["nearcatalog", "NearCatalog"],
] as const satisfies ReadonlyArray<readonly [ProposalPluginId, string]>;

interface ProposalRecord {
  id: string;
  pluginId: ProposalPluginId;
  entityId: string;
  payload: unknown;
  createdBy: string;
  reviewStatus: ProposalStatus;
  rejectionReason: string | null;
  applyStatus?: "not_started" | "applied" | "failed";
  applyError?: string | null;
  removeStatus?: "not_started" | "removed" | "failed";
  removeError?: string | null;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProposalAuditEntry {
  id: string;
  pluginId: string;
  entityId: string;
  action: string;
  actor: string;
  actorLabel: string | null;
  details: unknown;
  createdAt: string;
}

interface ReviewHistoryEntry extends ProposalAuditEntry {
  action: "approved" | "rejected";
  proposal: ProposalRecord;
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

function isNearAccountId(value: string) {
  return value.endsWith(".near") || value.endsWith(".testnet");
}

function isSystemAuditEntry(entry: ProposalAuditEntry) {
  const lifecycleActions = ["applied", "apply_failed", "removed", "remove_failed"];
  return entry.actor === "system" || (!entry.actorLabel && lifecycleActions.includes(entry.action));
}

function readAuditActor(entry: ProposalAuditEntry) {
  if (isSystemAuditEntry(entry)) {
    return { label: "System", nearAccount: null };
  }

  return {
    label: entry.actorLabel ?? entry.actor,
    nearAccount:
      entry.actorLabel && entry.actorLabel !== entry.actor && isNearAccountId(entry.actor)
        ? entry.actor
        : null,
  };
}

function formatAuditAction(entry: ProposalAuditEntry, pluginId: ProposalPluginId) {
  if (entry.action === "proposed") return "Submitted";
  if (entry.action === "approved") return "Approved";
  if (entry.action === "rejected") return "Rejected";
  if (entry.action === "reopened") return "Reopened for review";
  if (entry.action === "applied") {
    return pluginId === "nearcatalog" ? "Verified" : "Made public";
  }
  if (entry.action === "approval_revoked") return "Approval revoked";
  if (entry.action === "removed") {
    if (!isSystemAuditEntry(entry)) return "Approval revoked";
    if (pluginId === "builders") return "Removed from directory";
    if (pluginId === "nearcatalog") return "Verification removed";
    return "Made private";
  }
  if (entry.action === "apply_failed") return "Publishing failed";
  if (entry.action === "remove_failed") {
    return pluginId === "projects" || pluginId === "events"
      ? "Making private failed"
      : "Removal failed";
  }
  return entry.action.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRange(startAt: string, endAt: string | null) {
  const start = new Date(startAt);
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!endAt) return startLabel;
  const endLabel = new Date(endAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startLabel} - ${endLabel}`;
}

function AdminDashboard() {
  const [pluginTab, setPluginTab] = useState<ProposalPluginId>("builders");
  const [view, setView] = useState<DashboardView>("pending");
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const pendingCountQueries = useQueries({
    queries: PROPOSAL_TABS.map(([pluginId]) => ({
      queryKey: ["admin-proposals", pluginId, "count"],
      queryFn: async () => {
        const result = await apiClient.getProposals({
          pluginId,
          reviewStatus: "pending",
          limit: 1,
        });
        return result.meta.total;
      },
    })),
  });

  const proposalsQuery = useQuery({
    queryKey: ["admin-proposals", pluginTab],
    queryFn: async () => {
      const result = await apiClient.getProposals({
        pluginId: pluginTab,
        reviewStatus: pluginTab === "nearcatalog" ? undefined : "pending",
        limit: 50,
      });
      if (pluginTab === "nearcatalog") {
        await ensureCatalogProjects(
          queryClient,
          apiClient,
          result.data.map((proposal) => readString(readPayload(proposal.payload).projectSlug)),
        );
      }
      return result;
    },
    enabled: view === "pending",
  });

  const historyQuery = useInfiniteQuery({
    queryKey: ["admin-review-history", pluginTab],
    queryFn: ({ pageParam }) =>
      apiClient.getReviewHistory({
        pluginId: pluginTab,
        limit: 50,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: view === "history",
  });

  const proposals = ((proposalsQuery.data?.data ?? []) as ProposalRecord[]).filter(
    (proposal) =>
      pluginTab !== "nearcatalog" ||
      proposal.reviewStatus === "pending" ||
      proposal.reviewStatus === "approved",
  );
  const reviewHistory = (historyQuery.data?.pages.flatMap((page) => page.data) ??
    []) as ReviewHistoryEntry[];
  const isLoading = view === "pending" ? proposalsQuery.isLoading : historyQuery.isLoading;
  const isEmpty = view === "pending" ? proposals.length === 0 : reviewHistory.length === 0;

  const exportMutation = useMutation({
    mutationFn: () => exportProjectProposals(apiClient),
    onSuccess: (count) => {
      toast.success(`${count} project proposal${count !== 1 ? "s" : ""} exported`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to export"),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-3xl font-black tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Review builder, project, event, and NEAR Catalog contribution proposals.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="shrink-0"
        >
          {exportMutation.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Download size={13} />
          )}
          Export projects
        </Button>
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setView("pending")}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
            view === "pending"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock size={13} />
          Pending review
        </button>
        <button
          type="button"
          onClick={() => setView("history")}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
            view === "history"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History size={13} />
          Review history
        </button>
      </div>

      <div className="mb-6 flex gap-1">
        {PROPOSAL_TABS.map(([value, label], index) => (
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
            {view === "pending" ? ` (${pendingCountQueries[index]?.data ?? 0})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProposalReviewCardSkeleton key={i} />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="rounded-xl border border-border bg-muted/30 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">
            {view === "pending" ? "No pending proposals" : "No review history"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {view === "pending"
              ? `All caught up for ${pluginTab}.`
              : `Approved and rejected ${pluginTab} will appear here.`}
          </p>
        </div>
      ) : view === "pending" ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {proposals.length} proposal{proposals.length !== 1 ? "s" : ""} pending review
          </p>
          {proposals.map((proposal) => (
            <ProposalReviewCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {historyQuery.data?.pages[0]?.meta.total ?? reviewHistory.length} review decision
            {(historyQuery.data?.pages[0]?.meta.total ?? reviewHistory.length) !== 1 ? "s" : ""}
          </p>
          {reviewHistory.map((entry, index) => {
            const isLatestDecision =
              reviewHistory.findIndex(
                (candidate) =>
                  candidate.pluginId === entry.pluginId && candidate.entityId === entry.entityId,
              ) === index;
            const canUndo =
              isLatestDecision &&
              ((entry.action === "approved" &&
                (entry.proposal.reviewStatus === "approved" ||
                  entry.proposal.removeStatus === "failed")) ||
                (entry.action === "rejected" && entry.proposal.reviewStatus === "rejected"));

            return <ReviewHistoryCard key={entry.id} entry={entry} canUndo={canUndo} />;
          })}
          {historyQuery.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => historyQuery.fetchNextPage()}
                disabled={historyQuery.isFetchingNextPage}
              >
                {historyQuery.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProposalReviewCard({ proposal }: { proposal: ProposalRecord }) {
  if (proposal.pluginId === "nearcatalog") {
    return <CatalogClaimReviewCard proposal={proposal} />;
  }

  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const payload = useMemo(() => readPayload(proposal.payload), [proposal.payload]);

  const title =
    proposal.pluginId === "builders"
      ? (readString(payload.name) ?? proposal.entityId)
      : (readString(payload.title) ?? proposal.entityId);
  const eventStartAt = readString(payload.startAt);
  const eventEndAt = readString(payload.endAt);
  const eventDetails = readString(payload.content) ?? readString(payload.description);
  const lumaUrl = readString(payload.lumaUrl);

  const approveMutation = useMutation({
    mutationFn: () =>
      apiClient.approve({ pluginId: proposal.pluginId, entityId: proposal.entityId }),
    onSuccess: () => {
      toast.success(`${title} approved`);
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", proposal.pluginId] });
      queryClient.invalidateQueries({ queryKey: ["my-builder-profile"] });
      queryClient.invalidateQueries({ queryKey: ["builder-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["project-proposal", proposal.entityId] });
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
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["project-proposal", proposal.entityId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to reject"),
  });

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
        {proposal.pluginId === "builders" ? (
          <Hammer className="size-5 text-muted-foreground" />
        ) : proposal.pluginId === "events" ? (
          <CalendarDays className="size-5 text-muted-foreground" />
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

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {proposal.pluginId === "projects" && (
              <ProposalDetailsDialog proposal={proposal} payload={payload} title={title} />
            )}
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
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
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
        ) : proposal.pluginId === "events" ? (
          <>
            <div className="mt-3 grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 text-xs sm:grid-cols-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  Created by
                </div>
                <div className="mt-1 font-mono text-foreground">{proposal.createdBy}</div>
              </div>
              {eventStartAt && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Date
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-foreground">
                    <CalendarDays size={12} className="text-muted-foreground" />
                    {formatDate(eventStartAt)}
                  </div>
                </div>
              )}
              {eventStartAt && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Time
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-foreground">
                    <Clock size={12} className="text-muted-foreground" />
                    {formatTimeRange(eventStartAt, eventEndAt)}
                  </div>
                </div>
              )}
              {readString(payload.location) && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Location
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-foreground">
                    <MapPin size={12} className="text-muted-foreground" />
                    {readString(payload.location)}
                  </div>
                </div>
              )}
            </div>

            {eventDetails && (
              <div className="mt-3 rounded-xl border border-border/70 bg-background/40 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  Details
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {eventDetails}
                </p>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {readString(payload.visibility) && (
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs capitalize">
                  {readString(payload.visibility)}
                </Badge>
              )}
              {readString(payload.location) && (
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                  {readString(payload.location)}
                </Badge>
              )}
              {lumaUrl && (
                <a
                  href={lumaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                >
                  Luma
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </>
        ) : (
          <>
            {readString(payload.description) && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
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
          {proposal.pluginId !== "events" && (
            <>
              Created by{" "}
              <span className="font-mono text-muted-foreground">{proposal.createdBy}</span> ·{" "}
            </>
          )}
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

function ReviewHistoryCard({ entry, canUndo }: { entry: ReviewHistoryEntry; canUndo: boolean }) {
  const { proposal } = entry;
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const payload = readPayload(proposal.payload);
  const title =
    proposal.pluginId === "builders"
      ? (readString(payload.name) ?? proposal.entityId)
      : (readString(payload.title) ??
        readString(payload.projectSlug) ??
        readString(payload.name) ??
        proposal.entityId);
  const reviewer = entry.actorLabel ?? entry.actor;
  const reason = readString(readPayload(entry.details).reason);
  const isApproval = entry.action === "approved";
  const isRevocationFailed = isApproval && proposal.removeStatus === "failed";
  const isRevoked =
    isApproval && proposal.reviewStatus === "removed" && proposal.removeStatus === "removed";
  const isReopened = !isApproval && proposal.reviewStatus === "pending";
  const decisionLabel = isRevoked
    ? "Approval revoked"
    : isRevocationFailed
      ? "Revocation failed"
      : isReopened
        ? "Rejection reopened"
        : entry.action;
  const currentStatusMatchesDecision =
    (isApproval && proposal.reviewStatus === "approved") ||
    (!isApproval && proposal.reviewStatus === "rejected");

  const refreshReviewState = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-review-history", proposal.pluginId] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", proposal.pluginId] }),
      queryClient.invalidateQueries({
        queryKey: ["admin-proposal-audit", proposal.pluginId, proposal.entityId],
      }),
      queryClient.invalidateQueries({ queryKey: ["catalog-claim-proposals"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-claims"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
      queryClient.invalidateQueries({ queryKey: ["my-builder-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["builder-proposals"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
      queryClient.invalidateQueries({ queryKey: ["project-proposal", proposal.entityId] }),
    ]);

  const undoMutation = useMutation({
    mutationFn: () =>
      isApproval
        ? apiClient.remove({ pluginId: proposal.pluginId, entityId: proposal.entityId })
        : apiClient.reopen({ pluginId: proposal.pluginId, entityId: proposal.entityId }),
    onSuccess: async () => {
      setConfirmOpen(false);
      toast.success(isApproval ? `${title} approval revoked` : `${title} reopened for review`);
      await refreshReviewState();
    },
    onError: async (error: Error) => {
      toast.error(
        error.message || (isApproval ? "Failed to revoke approval" : "Failed to reopen proposal"),
      );
      await refreshReviewState();
    },
  });

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
            {isRevoked || isReopened || isRevocationFailed ? (
              <RotateCcw className="size-5 text-destructive" />
            ) : entry.action === "approved" ? (
              <Check className="size-5 text-foreground" />
            ) : (
              <X className="size-5 text-destructive" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-foreground">{title}</h2>
              <Badge
                variant={
                  isApproval && !isRevoked && !isRevocationFailed ? "secondary" : "destructive"
                }
                className="capitalize"
              >
                {decisionLabel}
              </Badge>
              {!currentStatusMatchesDecision && !isRevoked && !isReopened && (
                <Badge variant="outline" className="capitalize">
                  Current: {proposal.reviewStatus}
                </Badge>
              )}
              {readString(payload.kind) && (
                <Badge variant="outline" className="capitalize">
                  {readString(payload.kind)}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono">{proposal.entityId}</span> · submitted by{" "}
              <span className="font-mono">{proposal.createdBy}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ProposalAuditDialog proposal={proposal} title={title} />
          {canUndo && (
            <Button
              size="sm"
              variant={isApproval ? "destructive" : "outline"}
              onClick={() => setConfirmOpen(true)}
            >
              <RotateCcw className="size-4" />
              {isApproval
                ? isRevocationFailed
                  ? "Retry revocation"
                  : "Revoke approval"
                : "Reopen proposal"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm">
        <UserRound className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {isRevoked || isReopened
            ? `Originally ${entry.action === "approved" ? "approved" : "rejected"} by`
            : `${entry.action === "approved" ? "Approved" : "Rejected"} by`}
        </span>
        <span className="font-semibold text-foreground">{reviewer}</span>
        <span className="text-muted-foreground">on {formatDateTime(entry.createdAt)}</span>
      </div>

      {reason && (
        <p className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
          <span className="font-semibold">Reason:</span> {reason}
        </p>
      )}

      {isRevocationFailed && (
        <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
          <span className="font-semibold">Revocation failed:</span>{" "}
          {proposal.removeError ?? "The applied result could not be reversed. You can retry."}
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isApproval
                ? isRevocationFailed
                  ? "Retry this revocation?"
                  : "Revoke this approval?"
                : "Reopen this proposal?"}
            </DialogTitle>
            <DialogDescription>
              {isApproval
                ? isRevocationFailed
                  ? "This retries making the applied result private. The approval remains active until the reversal succeeds."
                  : "This reverses the applied result while keeping the original approval and revocation in the audit history."
                : "This returns the proposal to pending review and keeps the original rejection in the audit history."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={undoMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={isApproval ? "destructive" : "default"}
              onClick={() => undoMutation.mutate()}
              disabled={undoMutation.isPending}
            >
              {undoMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {isApproval
                ? isRevocationFailed
                  ? "Retry revocation"
                  : "Revoke approval"
                : "Reopen proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function ProposalAuditDialog({ proposal, title }: { proposal: ProposalRecord; title: string }) {
  const [open, setOpen] = useState(false);
  const apiClient = useApiClient();
  const auditQuery = useQuery({
    queryKey: ["admin-proposal-audit", proposal.pluginId, proposal.entityId],
    queryFn: () =>
      apiClient.getAuditLog({
        pluginId: proposal.pluginId,
        entityId: proposal.entityId,
        limit: 100,
      }),
    enabled: open,
  });
  const entries = (auditQuery.data?.data ?? []) as ProposalAuditEntry[];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <History size={13} />
          Full history
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Complete submission and review activity for this proposal.
          </DialogDescription>
        </DialogHeader>

        {auditQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity has been recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((auditEntry) => {
              const actor = readAuditActor(auditEntry);
              const details = readPayload(auditEntry.details);
              const reason = readString(details.reason);

              return (
                <div key={auditEntry.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {formatAuditAction(auditEntry, proposal.pluginId)}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">{actor.label}</span>
                      {actor.nearAccount && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {actor.nearAccount}
                        </span>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {formatDateTime(auditEntry.createdAt)}
                    </time>
                  </div>
                  {reason && <p className="mt-2 text-sm text-muted-foreground">{reason}</p>}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProposalDetailsDialog({
  proposal,
  payload,
  title,
}: {
  proposal: ProposalRecord;
  payload: Record<string, unknown>;
  title: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye size={13} />
          View details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Full {proposal.pluginId.slice(0, -1)} proposal submitted by {proposal.createdBy}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 overflow-hidden">
          <ProjectProposalPreview proposal={proposal} payload={payload} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectProposalPreview({
  proposal,
  payload,
}: {
  proposal: ProposalRecord;
  payload: Record<string, unknown>;
}) {
  const kind = readString(payload.kind) ?? "project";
  const title = readString(payload.title) ?? proposal.entityId;
  const visibility = readString(payload.visibility) ?? "private";
  const description = readString(payload.description);
  const content = readString(payload.content);
  const repository = readString(payload.repository);
  const readmeQuery = useQuery({
    queryKey: ["admin-project-readme", proposal.entityId, repository],
    queryFn: async () => {
      if (!repository) return null;
      return await fetchRepositoryReadme(repository);
    },
    enabled: kind === "project" && Boolean(repository),
  });
  const renderedContent = kind === "project" ? (readmeQuery.data ?? content) : content;

  return (
    <div className="max-w-full overflow-hidden rounded-2xl border border-border bg-background">
      <div className="max-h-[60vh] min-w-0 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-8 sm:py-6">
        <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <KindChip kind={kind} />
              <Badge variant="secondary" className="capitalize">
                {visibility === "private" && <Lock size={11} />}
                {visibility}
              </Badge>
            </div>
            <h2 className="text-[26px] font-semibold leading-tight text-foreground sm:text-[30px]">
              {title}
            </h2>
            {description && (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
            {repository && (
              <Button asChild size="sm" variant="outline" className="w-fit max-w-full min-w-0">
                <a href={repository} target="_blank" rel="noopener noreferrer">
                  <Globe size={13} />
                  <span className="min-w-0 truncate">
                    {repository.replace(/^https?:\/\/(www\.)?/, "")}
                  </span>
                  <ExternalLink size={11} className="shrink-0 text-muted-foreground" />
                </a>
              </Button>
            )}
          </div>

          {kind === "project" && readmeQuery.isLoading ? (
            <>
              <div className="h-px bg-border" />
              <p className="text-sm text-muted-foreground">Loading README...</p>
            </>
          ) : renderedContent ? (
            <>
              <div className="h-px bg-border" />
              <div className="min-w-0 max-w-full overflow-hidden">
                <Markdown content={renderedContent} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KindChip({ kind }: { kind: string }) {
  const icons: Record<string, ReactNode> = {
    idea: <FileText size={11} />,
    project: <FileCode2 size={11} />,
    scope: <Layers size={11} />,
    result: <BarChart2 size={11} />,
  };

  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
      {icons[kind] ?? <FileText size={11} />}
      {kind}
    </span>
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
