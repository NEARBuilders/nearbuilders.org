import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  History,
  Loader2,
  RotateCcw,
  Send,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ApiClient } from "@/app";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  formatAuditAction,
  formatDateTime,
  getAuditActor,
  getAuditDetail,
  getProjectKind,
  getProposalState,
  getProposalTitle,
  isLifecycleStalled,
  type ProposalPluginId,
  type ProposalRecord,
  readPayload,
  readString,
  readStringArray,
} from "./-proposal-dashboard";
import { ProposalStatusBadge } from "./-proposal-table";

type CatalogProject = Awaited<ReturnType<ApiClient["getCatalogProject"]>>["data"];
type AdminAction = "approve" | "reject" | "reopen" | "remove";

function getCategoryLabel(pluginId: string) {
  if (pluginId === "builders") return "Builder proposal";
  if (pluginId === "projects") return "Project proposal";
  if (pluginId === "events") return "Event proposal";
  return "Activity claim";
}

function getRevocationDescription(proposal: ProposalRecord) {
  if (proposal.pluginId === "builders") {
    return "This removes the builder from the public directory.";
  }
  if (proposal.pluginId === "projects") {
    return "This makes the project private.";
  }
  if (proposal.pluginId === "events") {
    return "This makes the event private.";
  }
  return "This removes the verified Catalog contribution.";
}

function SheetCloseButton() {
  return (
    <SheetClose asChild>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        className="size-10 sm:size-8"
        aria-label="Close proposal"
      >
        <X />
      </Button>
    </SheetClose>
  );
}

function DetailSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3.5">
      <div className={cn("flex gap-3", description ? "items-start" : "items-center")}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

function MetadataItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 bg-card px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          mono
            ? "mt-1.5 truncate font-mono text-xs text-foreground"
            : "mt-1.5 text-sm font-medium text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

function ProposalDestination({ proposal }: { proposal: ProposalRecord }) {
  const payload = readPayload(proposal.payload);
  if (proposal.pluginId === "nearcatalog") return null;
  if (proposal.pluginId === "builders") {
    return (
      <Button asChild size="sm" variant="outline" className="h-10 sm:h-8">
        <Link to="/builders/$account" params={{ account: proposal.entityId }}>
          View builder
          <ArrowUpRight />
        </Link>
      </Button>
    );
  }
  if (proposal.pluginId === "projects") {
    const slug = readString(payload.slug);
    if (!slug) return null;
    return (
      <Button asChild size="sm" variant="outline" className="h-10 sm:h-8">
        <Link
          to="/projects/$kind/$slug"
          params={{ kind: getProjectKind(payload.kind), slug }}
          search={{}}
        >
          View project
          <ArrowUpRight />
        </Link>
      </Button>
    );
  }
  if (proposal.pluginId === "events") {
    const slug = readString(payload.slug);
    if (!slug) return null;
    return (
      <Button asChild size="sm" variant="outline" className="h-10 sm:h-8">
        <Link to="/events/$slug" params={{ slug }}>
          View event
          <ArrowUpRight />
        </Link>
      </Button>
    );
  }
  return null;
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && Boolean(entry[1].trim()),
    ),
  );
}

function ProposalContent({
  proposal,
  catalogProject,
}: {
  proposal: ProposalRecord;
  catalogProject: CatalogProject | undefined;
}) {
  const payload = readPayload(proposal.payload);
  const repository = readString(payload.repository);
  const kind = getProjectKind(payload.kind);
  const content = readString(payload.content);

  if (proposal.pluginId === "builders") {
    const name = readString(payload.name) ?? getProposalTitle(proposal);
    const bio = readString(payload.bio);
    const location = readString(payload.location);
    const skills = readStringArray(payload.skills);
    const links = readStringRecord(payload.links);
    return (
      <div className="space-y-4">
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          <MetadataItem label="Display name" value={name} />
          <MetadataItem label="NEAR account" value={proposal.entityId} mono />
          {location && <MetadataItem label="Location" value={location} />}
        </div>
        {bio && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{bio}</p>
        )}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="rounded-full">
                {skill}
              </Badge>
            ))}
          </div>
        )}
        {Object.keys(links).length > 0 && (
          <div className="space-y-2">
            {Object.entries(links).map(([label, href]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary"
              >
                <span className="capitalize">{label}</span>
                <span className="truncate text-muted-foreground">{href}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (proposal.pluginId === "events") {
    const startAt = readString(payload.startAt);
    const endAt = readString(payload.endAt);
    const description = readString(payload.description);
    const lumaUrl = readString(payload.lumaUrl);
    return (
      <div className="space-y-4">
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          <MetadataItem
            label="Owner"
            value={readString(payload.ownerId) ?? proposal.createdBy}
            mono
          />
          {readString(payload.slug) && (
            <MetadataItem label="Slug" value={readString(payload.slug)!} mono />
          )}
          {startAt && <MetadataItem label="Starts" value={formatDateTime(startAt)} />}
          {endAt && <MetadataItem label="Ends" value={formatDateTime(endAt)} />}
          {readString(payload.location) && (
            <MetadataItem label="Location" value={readString(payload.location)!} />
          )}
          {readString(payload.visibility) && (
            <MetadataItem label="Visibility" value={readString(payload.visibility)!} />
          )}
        </div>
        {description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {content && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{content}</p>
        )}
        {lumaUrl && (
          <Button asChild size="sm" variant="outline">
            <a href={lumaUrl} target="_blank" rel="noopener noreferrer">
              Open Luma
              <ExternalLink />
            </a>
          </Button>
        )}
      </div>
    );
  }

  if (proposal.pluginId === "nearcatalog") {
    const roles = readStringArray(payload.roles);
    const nearAccount = readString(payload.nearAccount) ?? proposal.createdBy;
    return (
      <div className="space-y-4">
        {catalogProject && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
            {catalogProject.imageUrl ? (
              <img
                src={catalogProject.imageUrl}
                alt=""
                className="size-12 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary font-semibold text-foreground">
                {catalogProject.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-foreground">{catalogProject.name}</div>
              {catalogProject.tagline && (
                <p className="mt-1 text-sm text-muted-foreground">{catalogProject.tagline}</p>
              )}
            </div>
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-border">
          <MetadataItem label="Contributor" value={nearAccount} mono />
        </div>
        {roles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <Badge key={role} variant="secondary" className="rounded-full">
                {role}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  const description = readString(payload.description);
  const ownerId = readString(payload.ownerId) ?? proposal.createdBy;
  const slug = readString(payload.slug);
  const domain = readString(payload.domain);
  return (
    <div className="space-y-4">
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <MetadataItem label="Owner" value={ownerId} mono />
        {slug && <MetadataItem label="Slug" value={slug} mono />}
        {domain && <MetadataItem label="Domain" value={domain} mono />}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="capitalize">
          {kind}
        </Badge>
        {readString(payload.visibility) && (
          <Badge variant="outline" className="capitalize">
            {readString(payload.visibility)}
          </Badge>
        )}
      </div>
      {description && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {repository && (
        <Button asChild size="sm" variant="outline" className="max-w-full">
          <a href={repository} target="_blank" rel="noopener noreferrer">
            <span className="truncate">{repository.replace(/^https?:\/\/(www\.)?/, "")}</span>
            <ExternalLink />
          </a>
        </Button>
      )}
      {content && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{content}</p>
      )}
    </div>
  );
}

function AuditTimeline({ proposal }: { proposal: ProposalRecord }) {
  const apiClient = useApiClient();
  const auditQuery = useInfiniteQuery({
    queryKey: ["admin-proposal-audit", proposal.pluginId, proposal.entityId],
    queryFn: ({ pageParam }) =>
      apiClient.getAuditLog({
        pluginId: proposal.pluginId,
        entityId: proposal.entityId,
        limit: 50,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.meta.nextCursor ?? undefined,
  });

  if (auditQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (auditQuery.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
        <p className="text-sm font-semibold text-foreground">Audit history could not be loaded.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => auditQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const entries = auditQuery.data?.pages.flatMap((page) => page.data) ?? [];
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 text-center text-sm text-muted-foreground">
        No audit activity has been recorded.
      </div>
    );
  }

  return (
    <>
      <ol className="px-5">
        {entries.map((entry, index) => {
          const detail = getAuditDetail(entry);
          const isLatest = index === 0;
          const isFailure = entry.action === "apply_failed" || entry.action === "remove_failed";
          const isPositive = entry.action === "approved" || entry.action === "applied";
          const isNegative = entry.action === "rejected";
          const isRemoved = entry.action === "approval_revoked" || entry.action === "removed";
          const icon =
            entry.action === "proposed" ? (
              <Send />
            ) : isPositive ? (
              <CheckCircle2 />
            ) : isNegative ? (
              <XCircle />
            ) : entry.action === "reopened" ? (
              <RotateCcw />
            ) : isRemoved ? (
              <Archive />
            ) : isFailure ? (
              <CircleAlert />
            ) : (
              <History />
            );
          return (
            <li key={entry.id} className="relative flex gap-3.5">
              {index < entries.length - 1 && (
                <div className="absolute bottom-0 left-4 top-9 w-px bg-border" />
              )}
              <div
                className={cn(
                  "relative z-10 mt-4 flex size-8 shrink-0 items-center justify-center rounded-full border [&_svg]:size-3.5",
                  isPositive
                    ? "border-brand-mint-bright bg-brand-mint-soft text-brand-mint-foreground"
                    : isNegative || isFailure
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-border bg-secondary text-muted-foreground",
                )}
              >
                {icon}
              </div>
              <div className="min-w-0 flex-1 border-b border-border py-4 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold capitalize text-foreground">
                        {formatAuditAction(entry, proposal.pluginId as ProposalPluginId)}
                      </span>
                      {isLatest && (
                        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                          Latest
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserRound className="size-3" />
                      <span className="truncate">{getAuditActor(entry)}</span>
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </time>
                </div>
                {detail && (
                  <p className="mt-3 rounded-lg bg-secondary px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
                    {detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {auditQuery.hasNextPage && (
        <div className="border-t border-border p-4 text-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => auditQuery.fetchNextPage()}
            disabled={auditQuery.isFetchingNextPage}
          >
            {auditQuery.isFetchingNextPage && <Loader2 className="animate-spin" />}
            Load earlier activity
          </Button>
        </div>
      )}
    </>
  );
}

function changedPayloadFields(current: unknown, previous: unknown): string[] {
  const currentPayload = readPayload(current);
  const previousPayload = readPayload(previous);
  return Array.from(
    new Set([...Object.keys(currentPayload), ...Object.keys(previousPayload)]),
  ).filter((key) => JSON.stringify(currentPayload[key]) !== JSON.stringify(previousPayload[key]));
}

function SubmissionHistory({ proposal }: { proposal: ProposalRecord }) {
  const apiClient = useApiClient();
  const submissionsQuery = useInfiniteQuery({
    queryKey: ["admin-proposal-submissions", proposal.pluginId, proposal.entityId],
    queryFn: ({ pageParam }) =>
      apiClient.getProposalSubmissions({
        pluginId: proposal.pluginId,
        entityId: proposal.entityId,
        limit: 25,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.meta.nextCursor ?? undefined,
  });

  if (submissionsQuery.isLoading) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  if (submissionsQuery.isError) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Revision history could not be loaded.</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => submissionsQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const submissions = submissionsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const total = submissionsQuery.data?.pages[0]?.meta.total ?? submissions.length;

  return (
    <div>
      {submissions.map((submission, index) => {
        const previous = submissions[index + 1];
        const changedFields = previous
          ? changedPayloadFields(submission.payload, previous.payload)
          : [];
        const hasUnloadedPrevious =
          index === submissions.length - 1 && submissionsQuery.hasNextPage;
        return (
          <details key={submission.id} className="border-b border-border px-4 py-3 last:border-b-0">
            <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Revision {Math.max(1, total - index)}
                  </p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {submission.submittedBy} · {formatDateTime(submission.createdAt)}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 rounded-full">
                  {previous
                    ? `${changedFields.length} field${changedFields.length === 1 ? "" : "s"} changed`
                    : hasUnloadedPrevious
                      ? "Older revision"
                      : "Initial"}
                </Badge>
              </div>
              {changedFields.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{changedFields.join(", ")}</p>
              )}
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-secondary p-3 text-xs text-foreground">
              {JSON.stringify(submission.payload, null, 2)}
            </pre>
          </details>
        );
      })}
      {submissionsQuery.hasNextPage && (
        <div className="border-t border-border p-4 text-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => submissionsQuery.fetchNextPage()}
            disabled={submissionsQuery.isFetchingNextPage}
          >
            {submissionsQuery.isFetchingNextPage && <Loader2 className="animate-spin" />}
            Load earlier revisions
          </Button>
        </div>
      )}
    </div>
  );
}

export function ProposalReviewSheet({
  open,
  itemKey,
  proposal: nextProposal,
  loading,
  error,
  onRetry,
  onClose,
}: {
  open: boolean;
  itemKey: string | undefined;
  proposal: ProposalRecord | undefined;
  loading: boolean;
  error?: Error | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [copiedReference, setCopiedReference] = useState(false);
  const proposalCache = useRef<{
    itemKey: string | undefined;
    proposal: ProposalRecord | undefined;
  }>({ itemKey, proposal: nextProposal });

  if (itemKey && proposalCache.current.itemKey !== itemKey) {
    proposalCache.current = { itemKey, proposal: nextProposal };
  } else if (nextProposal) {
    proposalCache.current = { itemKey, proposal: nextProposal };
  }

  const proposal =
    nextProposal ??
    (!itemKey || proposalCache.current.itemKey === itemKey
      ? proposalCache.current.proposal
      : undefined);

  useEffect(() => {
    if (!itemKey) return;
    setRejecting(false);
    setConfirmingRemoval(false);
    setRejectionReason("");
    setCopiedReference(false);
  }, [itemKey]);

  const payload = proposal ? readPayload(proposal.payload) : {};
  const projectSlug = readString(payload.projectSlug);
  const catalogProjectQuery = useQuery({
    queryKey: ["catalog-project", projectSlug],
    queryFn: () => apiClient.getCatalogProject({ slug: projectSlug! }),
    enabled: open && proposal?.pluginId === "nearcatalog" && Boolean(projectSlug),
    staleTime: 5 * 60_000,
  });
  const catalogProject = catalogProjectQuery.data?.data;
  const title = proposal
    ? (catalogProject?.name ?? getProposalTitle(proposal))
    : "Proposal details";

  const refreshProposalState = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-proposals"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposal-count"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposal-selected"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposal-audit"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposal-submissions"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["projects-personal"] }),
      queryClient.invalidateQueries({ queryKey: ["project"] }),
      queryClient.invalidateQueries({ queryKey: ["project-proposal"] }),
      queryClient.invalidateQueries({ queryKey: ["builder-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
      queryClient.invalidateQueries({ queryKey: ["event"] }),
      queryClient.invalidateQueries({ queryKey: ["event-proposal"] }),
      queryClient.invalidateQueries({ queryKey: ["event-proposals"] }),
      queryClient.invalidateQueries({ queryKey: ["builders"] }),
      queryClient.invalidateQueries({ queryKey: ["builder"] }),
      queryClient.invalidateQueries({ queryKey: ["builder-proposals"] }),
      queryClient.invalidateQueries({ queryKey: ["proposals", "builders"] }),
      queryClient.invalidateQueries({ queryKey: ["my-builder-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-claim-proposals"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-claims"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
    ]);

  const actionMutation = useMutation({
    mutationFn: async (action: AdminAction) => {
      if (!proposal) throw new Error("Proposal not found");
      const input = {
        pluginId: proposal.pluginId,
        entityId: proposal.entityId,
        expectedUpdatedAt: proposal.updatedAt,
      };
      if (action === "approve") return apiClient.approve(input);
      if (action === "reject") {
        return apiClient.reject({ ...input, reason: rejectionReason.trim() || undefined });
      }
      if (action === "reopen") return apiClient.reopen(input);
      return apiClient.remove(input);
    },
    onSuccess: async (_, action) => {
      const messages: Record<AdminAction, string> = {
        approve: `${title} approved`,
        reject: `${title} rejected`,
        reopen: `${title} reopened`,
        remove: `${title} approval revoked`,
      };
      toast.success(messages[action]);
      setRejecting(false);
      setConfirmingRemoval(false);
      setRejectionReason("");
      await refreshProposalState();
    },
    onError: async (error: Error) => {
      toast.error(error.message || "The proposal could not be updated");
      await refreshProposalState();
    },
  });

  const state = proposal ? getProposalState(proposal) : null;
  const isBusy = actionMutation.isPending;
  const lifecycleStalled = Boolean(proposal && isLifecycleStalled(proposal));
  const lifecycleBusy =
    !lifecycleStalled &&
    (proposal?.applyStatus === "applying" || proposal?.removeStatus === "removing");
  const canRetryApplication =
    proposal?.reviewStatus === "approved" &&
    (proposal.applyStatus === "failed" ||
      (proposal.applyStatus === "applying" && lifecycleStalled));
  const canRetryRemoval =
    proposal?.reviewStatus === "approved" &&
    (proposal.removeStatus === "failed" ||
      (proposal.removeStatus === "removing" && lifecycleStalled));
  const canReject = proposal?.reviewStatus === "pending" && !lifecycleBusy;
  const hasActions = Boolean(
    proposal &&
      !lifecycleBusy &&
      (canReject || proposal.reviewStatus === "rejected" || proposal.reviewStatus === "approved"),
  );
  const copyReference = async () => {
    if (!proposal) return;
    try {
      await navigator.clipboard.writeText(proposal.entityId);
      setCopiedReference(true);
      toast.success("Proposal reference copied");
      window.setTimeout(() => setCopiedReference(false), 2000);
    } catch {
      toast.error("Proposal reference could not be copied");
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent
        side="right"
        hideCloseButton
        className="w-full max-w-none overflow-hidden rounded-none border-y-0 sm:max-w-2xl xl:max-w-3xl"
      >
        {loading ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border bg-secondary/30 px-5 py-6 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-5 w-36 rounded-full" />
                <SheetCloseButton />
              </div>
              <Skeleton className="mt-3 h-8 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </SheetHeader>
            <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          </div>
        ) : error && !proposal ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border bg-secondary/30 px-5 py-6 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle>Record could not be loaded</SheetTitle>
                  <SheetDescription className="mt-1">
                    The request failed. Retry without leaving this record.
                  </SheetDescription>
                </div>
                <SheetCloseButton />
              </div>
            </SheetHeader>
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <CircleAlert className="mx-auto size-7 text-destructive" />
                <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
                  Retry
                </Button>
              </div>
            </div>
          </div>
        ) : !proposal ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border bg-secondary/30 px-5 py-6 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle>Record unavailable</SheetTitle>
                  <SheetDescription className="mt-1">
                    This proposal does not exist or is not available in the selected category.
                  </SheetDescription>
                </div>
                <SheetCloseButton />
              </div>
            </SheetHeader>
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <CircleAlert className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Close this sheet and select another record from the table.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <SheetHeader className="border-b border-border bg-secondary/30 px-5 py-6 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {state && <ProposalStatusBadge state={state} />}
                  <Badge variant="outline" className="rounded-full bg-card">
                    {getCategoryLabel(proposal.pluginId)}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {proposal.pluginId !== "nearcatalog" && (
                    <ProposalDestination proposal={proposal} />
                  )}
                  <SheetCloseButton />
                </div>
              </div>
              <SheetTitle className="mt-3 max-w-xl text-2xl font-bold leading-tight">
                {title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Details and audit history for {title}.
              </SheetDescription>
              <div className="mt-2 flex min-w-0 items-center gap-1.5">
                <code className="min-w-0 truncate text-xs text-muted-foreground">
                  {proposal.entityId}
                </code>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="size-10 sm:size-8"
                  onClick={() => void copyReference()}
                  aria-label={
                    copiedReference ? "Proposal reference copied" : "Copy proposal reference"
                  }
                >
                  {copiedReference ? <Check /> : <Copy />}
                </Button>
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto bg-background px-5 py-6 sm:px-6">
              {(proposal.applyError || proposal.removeError) && (
                <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Lifecycle error</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {proposal.removeError ?? proposal.applyError}
                    </p>
                  </div>
                </div>
              )}

              <DetailSection
                icon={<ClipboardList className="size-4" />}
                title="Record"
                description="Identity, ownership, and submission timing."
              >
                <div className="grid gap-px bg-border sm:grid-cols-2">
                  <MetadataItem label="Submitted by" value={proposal.createdBy} mono />
                  <MetadataItem label="Submissions" value={String(proposal.submissionCount)} />
                  <MetadataItem label="Created" value={formatDateTime(proposal.createdAt)} />
                  <MetadataItem label="Last updated" value={formatDateTime(proposal.updatedAt)} />
                </div>
              </DetailSection>

              <DetailSection icon={<FileText className="size-4" />} title="Details">
                <div className="p-4">
                  <ProposalContent proposal={proposal} catalogProject={catalogProject} />
                </div>
              </DetailSection>

              <DetailSection icon={<ClipboardList className="size-4" />} title="Revisions">
                <SubmissionHistory proposal={proposal} />
              </DetailSection>

              <DetailSection
                icon={<History className="size-4" />}
                title="Audit trail"
                description="Administrative decisions and lifecycle activity."
              >
                <AuditTimeline proposal={proposal} />
              </DetailSection>
            </div>

            {hasActions && (
              <SheetFooter className="border-t border-border bg-background/95 px-5 py-4 backdrop-blur [&_button]:h-10 sm:px-6 sm:[&_button]:h-8">
                {rejecting ? (
                  <div className="w-full space-y-3">
                    <div>
                      <Label htmlFor="admin-rejection-reason">Reject proposal</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        The reason is optional and will be stored in the audit trail.
                      </p>
                    </div>
                    <Textarea
                      id="admin-rejection-reason"
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      placeholder="Reason for rejection (optional)"
                      maxLength={1000}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRejecting(false)}
                        disabled={isBusy}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => actionMutation.mutate("reject")}
                        disabled={isBusy}
                      >
                        {actionMutation.variables === "reject" && isBusy ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <X />
                        )}
                        Confirm rejection
                      </Button>
                    </div>
                  </div>
                ) : confirmingRemoval ? (
                  <div className="w-full space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Revoke this approval?</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {getRevocationDescription(proposal)}
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmingRemoval(false)}
                        disabled={isBusy}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => actionMutation.mutate("remove")}
                        disabled={isBusy}
                      >
                        {actionMutation.variables === "remove" && isBusy && (
                          <Loader2 className="animate-spin" />
                        )}
                        {canRetryRemoval ? "Retry revocation" : "Revoke approval"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full justify-end">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canReject && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejecting(true)}
                          disabled={isBusy}
                        >
                          <X />
                          Reject
                        </Button>
                      )}
                      {proposal.reviewStatus === "pending" || canRetryApplication ? (
                        <Button
                          size="sm"
                          onClick={() => actionMutation.mutate("approve")}
                          disabled={isBusy}
                        >
                          {actionMutation.variables === "approve" && isBusy ? (
                            <Loader2 className="animate-spin" />
                          ) : canRetryApplication ? (
                            <RotateCcw />
                          ) : (
                            <Check />
                          )}
                          {canRetryApplication ? "Retry application" : "Approve"}
                        </Button>
                      ) : proposal.reviewStatus === "rejected" ? (
                        <Button
                          size="sm"
                          onClick={() => actionMutation.mutate("reopen")}
                          disabled={isBusy}
                        >
                          {actionMutation.variables === "reopen" && isBusy ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <RotateCcw />
                          )}
                          Reopen
                        </Button>
                      ) : proposal.reviewStatus === "approved" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setConfirmingRemoval(true)}
                        >
                          <RotateCcw />
                          {canRetryRemoval ? "Retry revocation" : "Revoke approval"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
