import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  Check,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FeedbackStatus = "open" | "filling" | "testing" | "complete" | "closed";
type ApplicationStatus = "pending" | "selected" | "rejected" | "withdrawn";
type ScopeFilter = "all" | "posted" | "applied";

interface FeedbackRequest {
  id: string;
  ownerNearAccount: string;
  projectId: string;
  projectSlug: string;
  projectKind: "project" | "idea" | "scope" | "result";
  projectTitle: string;
  title: string;
  body: string;
  testersWanted: number;
  timeframeDays: number;
  targetRepo: string;
  requirements: string | null;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  applicationCounts: { pending: number; selected: number };
}

interface RequestsResponse {
  data: FeedbackRequest[];
  meta: { total: number; hasMore: boolean; nextCursor: string | null };
}

interface FiledIssue {
  url: string;
  title: string | null;
  filedAt: string;
}

interface FeedbackApplication {
  id: string;
  requestId: string;
  applicantNearAccount: string;
  note: string | null;
  status: ApplicationStatus;
  requestTitle: string;
  requestProjectTitle: string;
  requestTargetRepo: string;
  appliedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  filedIssues: FiledIssue[];
  submittedAt: string | null;
}

interface ApplicationsResponse {
  data: FeedbackApplication[];
  meta: { total: number; hasMore: boolean; nextCursor: string | null };
}

interface ProjectSummary {
  id: string;
  slug: string;
  kind: "project" | "idea" | "scope" | "result";
  title: string;
  repository?: string | null;
}

interface ProjectsResponse {
  data: ProjectSummary[];
}

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "Open",
  filling: "Filling",
  testing: "Testing",
  complete: "Complete",
  closed: "Closed",
};

const STATUS_PILL: Record<FeedbackStatus, string> = {
  open: "border-border bg-secondary text-muted-foreground",
  filling: "border-brand-accent-border bg-brand-accent-light text-brand-accent",
  testing: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  complete: "border-brand-accent-border bg-brand-accent-light text-brand-accent",
  closed: "border-border bg-secondary text-muted-foreground",
};

export const Route = createFileRoute("/_layout/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback requests | NEAR Builders" },
      {
        name: "description",
        content:
          "Two-sided feedback marketplace: projects source structured feedback from builders. Apply, test, file issues, get credit.",
      },
    ],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const nearAccountId = auth.near.getAccountId();
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

  const [scope, setScope] = useState<ScopeFilter>("all");
  const [status, setStatus] = useState<FeedbackStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [postOpen, setPostOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["feedback", "requests", { scope, status, nearAccountId }],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50 };
      if (status !== "all") params.status = status;
      if (scope === "posted" && nearAccountId) params.ownerNearAccount = nearAccountId;
      return (await apiClient.feedback.listFeedbackRequests(params)) as RequestsResponse;
    },
    enabled: scope !== "posted" || Boolean(nearAccountId),
    staleTime: 30_000,
  });

  const myApplicationsQuery = useQuery({
    queryKey: ["feedback", "my-applications", nearAccountId],
    queryFn: async () =>
      (await apiClient.feedback.listFeedbackApplications({
        applicantNearAccount: nearAccountId!,
        limit: 50,
      })) as ApplicationsResponse,
    enabled: Boolean(nearAccountId),
    staleTime: 30_000,
  });

  const myApplications = myApplicationsQuery.data?.data ?? [];
  const applicationByRequestId = useMemo(() => {
    const m = new Map<string, FeedbackApplication>();
    for (const a of myApplications) m.set(a.requestId, a);
    return m;
  }, [myApplications]);

  const requests = listQuery.data?.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.projectTitle.toLowerCase().includes(q) ||
        r.targetRepo.toLowerCase().includes(q),
    );
  }, [requests, search]);

  const inListSelected = requests.find((r) => r.id === selectedId) ?? null;

  const selectedFetchQuery = useQuery({
    queryKey: ["feedback", "request", selectedId],
    queryFn: async () =>
      (await apiClient.feedback.getFeedbackRequest({ id: selectedId! })) as {
        data: FeedbackRequest;
      },
    enabled: Boolean(selectedId) && !inListSelected,
    staleTime: 30_000,
  });

  const selected = inListSelected ?? selectedFetchQuery.data?.data ?? null;
  const selectedApplication = selected ? (applicationByRequestId.get(selected.id) ?? null) : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:py-5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">Feedback requests</h1>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            Projects source structured feedback from real users. Apply to test, file issues on the
            project's own repo, get credit on your profile.
          </p>
        </div>
        {isAuthenticated ? (
          <Button size="sm" className="shrink-0" onClick={() => setPostOpen(true)}>
            <Plus size={14} />
            Post a request
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0" disabled>
            Connect to post
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 py-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search title, project, or repo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5">
          {(
            [
              { v: "all", label: "All" },
              { v: "posted", label: "Posted" },
              { v: "applied", label: "Applied" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setScope(opt.v)}
              disabled={opt.v !== "all" && !nearAccountId}
              className={cn(
                "h-7 px-3 rounded-md text-sm font-semibold cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
                scope === opt.v
                  ? "bg-card dark:bg-accent text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
              {opt.v === "applied" && myApplications.length > 0 && (
                <span className="ml-1.5 inline-block min-w-[18px] rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
                  {myApplications.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v as FeedbackStatus | "all")}>
          <SelectTrigger
            size="sm"
            className="h-8 w-auto gap-1.5 rounded-lg bg-secondary font-semibold"
            aria-label="Filter by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="filling">Filling</SelectItem>
            <SelectItem value="testing">Testing</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scope === "applied" ? (
        <AppliedList
          applications={myApplications}
          loading={myApplicationsQuery.isLoading}
          onOpenApplication={(app) => setSelectedId(app.requestId)}
          apiClient={apiClient}
        />
      ) : listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 pb-16 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : listQuery.isError ? (
        <ErrorCard message={(listQuery.error as Error)?.message} />
      ) : filtered.length === 0 ? (
        <EmptyState scope={scope} onPost={() => setPostOpen(true)} canPost={isAuthenticated} />
      ) : (
        <div className="grid grid-cols-1 gap-3 pb-16 sm:grid-cols-2">
          {filtered.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              application={applicationByRequestId.get(request.id) ?? null}
              onOpen={() => setSelectedId(request.id)}
            />
          ))}
        </div>
      )}

      <Sheet open={postOpen} onOpenChange={setPostOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <PostRequestForm
            nearAccountId={nearAccountId}
            onClose={() => setPostOpen(false)}
            onCreated={(id) => {
              setPostOpen(false);
              setSelectedId(id);
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <RequestDetail
              request={selected}
              application={selectedApplication}
              currentNearAccount={nearAccountId ?? null}
              isAuthenticated={isAuthenticated}
            />
          ) : selectedFetchQuery.isLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RequestCard({
  request,
  application,
  onOpen,
}: {
  request: FeedbackRequest;
  application: FeedbackApplication | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{request.projectTitle}</p>
          <p className="text-[11px] text-muted-foreground">
            by <span className="font-mono">{request.ownerNearAccount}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {application && <ApplicationChip status={application.status} />}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
              STATUS_PILL[request.status],
            )}
          >
            <span className="size-1.5 rounded-full bg-current opacity-70" />
            {STATUS_LABEL[request.status]}
          </span>
        </div>
      </div>
      <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
        {request.title}
      </h3>
      <p className="line-clamp-2 text-xs text-muted-foreground">{request.body}</p>
      <TesterProgress request={request} />
      <div className="mt-auto flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-semibold">
          <Calendar className="size-3" />
          {daysUntil(request.expiresAt)}
        </span>
        <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono font-semibold">
          {request.targetRepo}
        </span>
      </div>
    </button>
  );
}

function TesterProgress({ request }: { request: FeedbackRequest }) {
  const { selected, pending } = request.applicationCounts;
  const total = request.testersWanted;
  const filled = Math.min(selected, total);
  const percent = total > 0 ? (filled / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-border bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            request.status === "testing" || request.status === "complete"
              ? "bg-amber-500"
              : "bg-brand-accent",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-[10px] font-bold tabular-nums text-muted-foreground">
        {filled}/{total} testers
        {pending > 0 && request.status === "filling" && ` · ${pending} pending`}
      </span>
    </div>
  );
}

function ApplicationChip({ status }: { status: ApplicationStatus }) {
  const label =
    status === "pending"
      ? "Applied"
      : status === "selected"
        ? "Selected"
        : status === "rejected"
          ? "Not selected"
          : "Withdrawn";
  const tone =
    status === "selected"
      ? "border-brand-accent-border bg-brand-accent-light text-brand-accent"
      : status === "pending"
        ? "border-brand-accent-border bg-brand-accent-light text-brand-accent"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        tone,
      )}
    >
      {status === "selected" && <Check className="size-2.5" />}
      {label}
    </span>
  );
}

function AppliedList({
  applications,
  loading,
  onOpenApplication,
  apiClient,
}: {
  applications: FeedbackApplication[];
  loading: boolean;
  onOpenApplication: (application: FeedbackApplication) => void;
  apiClient: ReturnType<typeof useApiClient>;
}) {
  const queryClient = useQueryClient();
  const withdrawMutation = useMutation({
    mutationFn: async (id: string) => apiClient.feedback.withdrawFeedbackApplication({ id }),
    onSuccess: () => {
      toast.success("Application withdrawn");
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not withdraw"),
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 pb-16 sm:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-accent-light text-brand-accent">
          <MessageSquare className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            You haven't applied to any feedback requests
          </p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Browse open requests and apply to one that fits.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 pb-16 sm:grid-cols-2">
      {applications.map((application) => (
        <div
          key={application.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {application.requestProjectTitle}
              </p>
              <p className="text-[11px] text-muted-foreground">
                applied {relative(application.appliedAt)}
              </p>
            </div>
            <ApplicationChip status={application.status} />
          </div>
          <button
            type="button"
            onClick={() => onOpenApplication(application)}
            className="line-clamp-2 text-left text-sm font-bold leading-snug text-foreground hover:text-brand-accent"
          >
            {application.requestTitle}
          </button>
          {application.note && (
            <p className="line-clamp-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] italic text-muted-foreground">
              "{application.note}"
            </p>
          )}
          <div className="mt-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
              {application.requestTargetRepo}
            </span>
            {application.status === "pending" && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                disabled={withdrawMutation.isPending}
                onClick={() => withdrawMutation.mutate(application.id)}
              >
                <Undo2 className="size-3" />
                Withdraw
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestDetail({
  request,
  application,
  currentNearAccount,
  isAuthenticated,
}: {
  request: FeedbackRequest;
  application: FeedbackApplication | null;
  currentNearAccount: string | null;
  isAuthenticated: boolean;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const isOwner =
    !!currentNearAccount &&
    currentNearAccount.toLowerCase() === request.ownerNearAccount.toLowerCase();
  const isOpenForApplications = request.status === "open" || request.status === "filling";
  const isExpired = new Date(request.expiresAt).getTime() <= Date.now();

  const applyMutation = useMutation({
    mutationFn: async () =>
      apiClient.feedback.applyToFeedbackRequest({
        requestId: request.id,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Application submitted");
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      setNote("");
    },
    onError: (error: Error) => toast.error(error.message || "Could not apply"),
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!application) throw new Error("No application to withdraw");
      return apiClient.feedback.withdrawFeedbackApplication({ id: application.id });
    },
    onSuccess: () => {
      toast.success("Application withdrawn");
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not withdraw"),
  });

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              STATUS_PILL[request.status],
            )}
          >
            {STATUS_LABEL[request.status]}
          </span>
          <span>·</span>
          <span>{request.projectTitle}</span>
        </div>
        <SheetTitle className="text-left text-lg">{request.title}</SheetTitle>
        <SheetDescription className="sr-only">Feedback request details</SheetDescription>
      </SheetHeader>

      <section className="mt-4 space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          What to test
        </h4>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {request.body}
        </div>
      </section>

      <section className="mt-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Details
        </h4>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Testers wanted</dt>
            <dd className="mt-0.5 font-semibold text-foreground">{request.testersWanted}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Timeframe</dt>
            <dd className="mt-0.5 font-semibold text-foreground">{daysUntil(request.expiresAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">File issues to</dt>
            <dd className="mt-0.5 font-mono text-[11px] font-semibold text-foreground break-all">
              {request.targetRepo}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Posted by</dt>
            <dd className="mt-0.5 font-mono text-[11px] font-semibold text-foreground break-all">
              {request.ownerNearAccount}
            </dd>
          </div>
        </dl>
      </section>

      {request.requirements && (
        <section className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Requirements
          </h4>
          <p className="mt-2 text-xs text-muted-foreground">{request.requirements}</p>
        </section>
      )}

      {isOwner ? (
        <OwnerApplicationsPanel request={request} />
      ) : application ? (
        <>
          <div className="mt-6 rounded-lg border border-brand-accent-border bg-brand-accent-light/40 p-3">
            <div className="flex items-center gap-2">
              <ApplicationChip status={application.status} />
              <span className="text-[11px] text-muted-foreground">
                submitted {relative(application.appliedAt)}
              </span>
            </div>
            {application.note && (
              <p className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
                "{application.note}"
              </p>
            )}
            {application.status === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-3 h-8"
                disabled={withdrawMutation.isPending}
                onClick={() => withdrawMutation.mutate()}
              >
                <Undo2 className="mr-1 size-3" />
                {withdrawMutation.isPending ? "Withdrawing…" : "Withdraw application"}
              </Button>
            )}
          </div>
          {application.status === "selected" && <FiledIssuesPanel application={application} />}
        </>
      ) : isAuthenticated && currentNearAccount && isOpenForApplications && !isExpired ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-semibold text-foreground">Apply to test</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Add a short note about why you're a fit. The project owner picks their testers.
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional. E.g. 'I've built two similar wallet flows and can test on both Ledger and mobile.'"
            className="mt-3 min-h-[80px] text-xs"
            maxLength={600}
          />
          <Button
            size="sm"
            className="mt-3"
            disabled={applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
          >
            {applyMutation.isPending ? "Applying…" : "Apply to test"}
          </Button>
        </div>
      ) : !isOpenForApplications ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          This request is {STATUS_LABEL[request.status].toLowerCase()} and no longer accepting new
          testers.
        </div>
      ) : isExpired ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          This request has expired.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Connect your NEAR wallet to apply.
        </div>
      )}

      <Button asChild size="sm" variant="outline" className="mt-4 w-full justify-center">
        <a
          href={`https://github.com/${request.targetRepo}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open {request.targetRepo} on GitHub
          <ExternalLink className="ml-1 size-3" />
        </a>
      </Button>
    </>
  );
}

function EmptyState({
  scope,
  canPost,
  onPost,
}: {
  scope: ScopeFilter;
  canPost: boolean;
  onPost: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-accent-light text-brand-accent">
        <MessageSquare className="size-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {scope === "posted" ? "You haven't posted any feedback requests" : "No open requests yet"}
        </p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          When a project posts a feedback request, it shows up here. Testers apply, the project
          picks, and filed issues go on your builder profile.
        </p>
      </div>
      {canPost && (
        <Button size="sm" onClick={onPost} className="mt-2">
          <Plus size={14} />
          Post the first one
        </Button>
      )}
      {!canPost && (
        <Link
          to="/settings"
          className="mt-2 text-xs font-semibold text-brand-accent hover:underline"
        >
          Connect a wallet to post
        </Link>
      )}
    </div>
  );
}

function FiledIssuesPanel({ application }: { application: FeedbackApplication }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const invalidateAfter = () => queryClient.invalidateQueries({ queryKey: ["feedback"] });

  const attachMutation = useMutation({
    mutationFn: async () =>
      apiClient.feedback.attachFiledIssue({
        id: application.id,
        url: url.trim(),
        title: title.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Issue attached");
      setUrl("");
      setTitle("");
      invalidateAfter();
    },
    onError: (error: Error) => toast.error(error.message || "Could not attach"),
  });

  const removeMutation = useMutation({
    mutationFn: async (removeUrl: string) =>
      apiClient.feedback.removeFiledIssue({ id: application.id, url: removeUrl }),
    onSuccess: () => {
      toast.success("Issue removed");
      invalidateAfter();
    },
    onError: (error: Error) => toast.error(error.message || "Could not remove"),
  });

  const urlValid = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+/.test(url.trim());

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Filed issues</p>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
          {application.filedIssues.length} filed
        </span>
      </div>

      {application.filedIssues.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {application.filedIssues.map((issue) => (
            <div
              key={issue.url}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5"
            >
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-[11px] font-semibold text-foreground hover:text-brand-accent hover:underline"
              >
                {issue.title || issue.url.replace(/^https:\/\/github\.com\//, "")}
              </a>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 shrink-0 px-1.5"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(issue.url)}
                aria-label="Remove issue"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/issues/123"
          className="h-8 font-mono text-[11px]"
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short title (optional)"
          className="h-8 text-xs"
          maxLength={240}
        />
        <Button
          size="sm"
          className="h-8"
          disabled={!urlValid || attachMutation.isPending}
          onClick={() => attachMutation.mutate()}
        >
          <Plus className="mr-1 size-3" />
          {attachMutation.isPending ? "Attaching…" : "Attach issue"}
        </Button>
        {url && !urlValid && (
          <p className="text-[10px] text-destructive">
            Must be a github.com issue link (e.g. github.com/owner/repo/issues/123).
          </p>
        )}
      </div>
    </div>
  );
}

function OwnerApplicationsPanel({ request }: { request: FeedbackRequest }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const applicationsQuery = useQuery({
    queryKey: ["feedback", "request-applications", request.id],
    queryFn: async () =>
      (await apiClient.feedback.listFeedbackApplications({
        requestId: request.id,
        limit: 50,
      })) as ApplicationsResponse,
    staleTime: 15_000,
  });

  const invalidateAfter = () => {
    queryClient.invalidateQueries({ queryKey: ["feedback"] });
  };

  const selectMutation = useMutation({
    mutationFn: async (id: string) => apiClient.feedback.selectFeedbackApplicant({ id }),
    onSuccess: () => {
      toast.success("Applicant selected");
      invalidateAfter();
    },
    onError: (error: Error) => toast.error(error.message || "Could not select"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => apiClient.feedback.rejectFeedbackApplicant({ id }),
    onSuccess: () => {
      toast.success("Applicant declined");
      invalidateAfter();
    },
    onError: (error: Error) => toast.error(error.message || "Could not decline"),
  });

  const completeMutation = useMutation({
    mutationFn: async () => apiClient.feedback.markFeedbackRequestComplete({ id: request.id }),
    onSuccess: () => {
      toast.success("Round marked complete");
      invalidateAfter();
    },
    onError: (error: Error) => toast.error(error.message || "Could not mark complete"),
  });

  const applications = applicationsQuery.data?.data ?? [];
  const selected = applications.filter((a) => a.status === "selected");
  const pending = applications.filter((a) => a.status === "pending");
  const rejected = applications.filter((a) => a.status === "rejected");
  const withdrawn = applications.filter((a) => a.status === "withdrawn");

  const quotaMet = selected.length >= request.testersWanted;
  const canDecide = request.status === "filling";

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Applications</p>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
          {selected.length}/{request.testersWanted} selected
        </span>
      </div>
      <TesterProgress request={request} />

      {applicationsQuery.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : applications.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No applications yet. Once builders apply, you can pick them here.
        </p>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Pending ({pending.length})
              </p>
              {pending.map((a) => (
                <ApplicantRow
                  key={a.id}
                  application={a}
                  canDecide={canDecide && !quotaMet}
                  onSelect={() => selectMutation.mutate(a.id)}
                  onReject={() => rejectMutation.mutate(a.id)}
                  busySelect={selectMutation.isPending && selectMutation.variables === a.id}
                  busyReject={rejectMutation.isPending && rejectMutation.variables === a.id}
                />
              ))}
            </div>
          )}
          {selected.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                Selected ({selected.length})
              </p>
              {selected.map((a) => (
                <ApplicantRow key={a.id} application={a} canDecide={false} />
              ))}
            </div>
          )}
          {(rejected.length > 0 || withdrawn.length > 0) && (
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer font-semibold hover:text-foreground">
                Closed ({rejected.length + withdrawn.length})
              </summary>
              <div className="mt-2 space-y-1.5">
                {[...rejected, ...withdrawn].map((a) => (
                  <ApplicantRow key={a.id} application={a} canDecide={false} muted />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {selected.length > 0 && (request.status === "testing" || request.status === "filling") && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Filed issues so far
          </p>
          <div className="mt-2 space-y-2">
            {selected.map((a) =>
              a.filedIssues.length === 0 ? (
                <p key={a.id} className="text-[11px] text-muted-foreground">
                  <span className="font-mono">{a.applicantNearAccount}</span> — no issues yet
                </p>
              ) : (
                <div key={a.id}>
                  <p className="text-[11px] font-mono font-semibold text-foreground">
                    {a.applicantNearAccount} · {a.filedIssues.length}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {a.filedIssues.map((issue) => (
                      <li key={issue.url} className="truncate text-[11px] text-muted-foreground">
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-brand-accent hover:underline"
                        >
                          {issue.title || issue.url.replace(/^https:\/\/github\.com\//, "")}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {(request.status === "testing" || request.status === "filling") && selected.length > 0 && (
        <Button
          size="sm"
          className="w-full"
          disabled={completeMutation.isPending}
          onClick={() => completeMutation.mutate()}
        >
          <CheckCircle2 className="mr-1 size-3.5" />
          {completeMutation.isPending ? "Marking…" : "Mark round complete"}
        </Button>
      )}

      {!canDecide && request.status !== "testing" && (
        <p className="rounded-md border border-dashed border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          Selection window is closed (request is {STATUS_LABEL[request.status].toLowerCase()}).
        </p>
      )}
    </div>
  );
}

function ApplicantRow({
  application,
  canDecide,
  onSelect,
  onReject,
  busySelect,
  busyReject,
  muted,
}: {
  application: FeedbackApplication;
  canDecide: boolean;
  onSelect?: () => void;
  onReject?: () => void;
  busySelect?: boolean;
  busyReject?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background/40 p-2.5",
        muted && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-[12px] font-semibold text-foreground">
            {application.applicantNearAccount}
          </p>
          <p className="text-[10px] text-muted-foreground">
            applied {relative(application.appliedAt)}
          </p>
        </div>
        {application.status !== "pending" && <ApplicationChip status={application.status} />}
      </div>
      {application.note && (
        <p className="mt-1.5 rounded border border-border bg-muted/40 px-2 py-1 text-[11px] italic text-muted-foreground">
          "{application.note}"
        </p>
      )}
      {canDecide && (
        <div className="mt-2 flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            disabled={busyReject || busySelect}
            onClick={onReject}
          >
            {busyReject ? "…" : "Decline"}
          </Button>
          <Button
            size="sm"
            className="h-7 text-[11px]"
            disabled={busySelect || busyReject}
            onClick={onSelect}
          >
            <Check className="mr-1 size-3" />
            {busySelect ? "…" : "Select"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ErrorCard({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm font-semibold text-foreground">Could not load feedback requests</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {message ?? "Please try again in a moment."}
      </p>
    </div>
  );
}

function PostRequestForm({
  nearAccountId,
  onClose,
  onCreated,
}: {
  nearAccountId: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [testersWanted, setTestersWanted] = useState<number>(5);
  const [timeframeDays, setTimeframeDays] = useState<number>(14);
  const [targetRepo, setTargetRepo] = useState("");
  const [requirements, setRequirements] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["my-projects-for-feedback", nearAccountId],
    queryFn: async () => {
      const result = (await apiClient.listProjects({
        ownerId: nearAccountId ?? undefined,
        limit: 50,
      })) as ProjectsResponse;
      return result.data;
    },
    enabled: !!nearAccountId,
    staleTime: 60_000,
  });

  const projects = projectsQuery.data ?? [];
  const selectedProject = projects.find((p) => p.id === projectId);

  const canSubmit =
    Boolean(selectedProject) &&
    title.trim().length >= 4 &&
    body.trim().length >= 20 &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(targetRepo.trim()) &&
    testersWanted >= 1 &&
    testersWanted <= 20 &&
    timeframeDays >= 1 &&
    timeframeDays <= 30;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProject) throw new Error("Choose a project first");
      return apiClient.feedback.createFeedbackRequest({
        projectId: selectedProject.id,
        projectSlug: selectedProject.slug,
        projectKind: selectedProject.kind,
        projectTitle: selectedProject.title,
        title: title.trim(),
        body: body.trim(),
        testersWanted,
        timeframeDays,
        targetRepo: targetRepo.trim(),
        requirements: requirements.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      toast.success("Feedback request published");
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      onCreated((result as { data: { id: string } }).data.id);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not publish request");
    },
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-left text-lg">Post a feedback request</SheetTitle>
        <SheetDescription className="text-left text-xs text-muted-foreground">
          Say what to test, how many testers, timeframe, and which repo issues get filed to.
          Publishing sends a notification to builders following your project.
        </SheetDescription>
      </SheetHeader>

      <div className="mt-4 space-y-4">
        <Field label="Project" hint="Only your own projects show up here.">
          {projectsQuery.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : projects.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
              You haven't linked any projects yet.{" "}
              <Link
                to="/projects/new/$kind"
                params={{ kind: "project" }}
                search={{ tab: "write" }}
                className="font-semibold text-brand-accent hover:underline"
              >
                Add a project
              </Link>{" "}
              to post a feedback request.
            </div>
          ) : (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose one of your projects" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field label="Title" hint="Short and specific — say what you want tested and by whom.">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Test the new signup flow, first-time users only"
            maxLength={140}
          />
        </Field>

        <Field
          label="What to test"
          hint="Describe the flow, feature, or area. Note constraints (testnet only? mobile only?)."
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What should testers exercise? What kind of issues are you most interested in?"
            className="min-h-[120px]"
            maxLength={4000}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Testers wanted" hint="1 – 20">
            <Input
              type="number"
              min={1}
              max={20}
              value={testersWanted}
              onChange={(e) => setTestersWanted(Math.max(1, Math.min(20, Number(e.target.value))))}
            />
          </Field>
          <Field label="Timeframe (days)" hint="1 – 30">
            <Input
              type="number"
              min={1}
              max={30}
              value={timeframeDays}
              onChange={(e) => setTimeframeDays(Math.max(1, Math.min(30, Number(e.target.value))))}
            />
          </Field>
        </div>

        <Field label="Issues get filed to" hint="Your project's GitHub repo — owner/repo format.">
          <Input
            value={targetRepo}
            onChange={(e) => setTargetRepo(e.target.value)}
            placeholder="publicai/app"
            className="font-mono text-sm"
          />
        </Field>

        <Field
          label="Requirements (optional)"
          hint="One line. E.g. 'Requires Ledger', 'Non-technical welcome'."
        >
          <Input
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="Optional constraint"
            maxLength={200}
          />
        </Field>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!canSubmit || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Publishing…" : "Publish request"}
        </Button>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* biome-ignore lint/a11y/noLabelWithoutControl: label wraps a custom input component */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-foreground">{label}</span>
        {children}
      </label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function daysUntil(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = then - Date.now();
  if (diffMs <= 0) return "expired";
  const days = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
  return `${days}d left`;
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const abs = Math.abs(diffMs);
  const past = diffMs >= 0;
  const suffix = past ? "ago" : "from now";
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  if (abs < minute) return "just now";
  if (abs < hour) return `${Math.round(abs / minute)}m ${suffix}`;
  if (abs < day) return `${Math.round(abs / hour)}h ${suffix}`;
  if (abs < week) return `${Math.round(abs / day)}d ${suffix}`;
  if (abs < month) return `${Math.round(abs / week)}w ${suffix}`;
  return `${Math.round(abs / month)}mo ${suffix}`;
}
