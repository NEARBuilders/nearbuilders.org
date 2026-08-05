import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  ExternalLink,
  GitPullRequest,
  MessageSquare,
  Search,
  Tag,
  User as UserIcon,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

type Difficulty = "beginner" | "intermediate" | "advanced" | "unknown";
type ClaimedFilter = "any" | "open" | "claimed";

const DIFFICULTY_OPTIONS: { value: Difficulty | "all"; label: string }[] = [
  { value: "all", label: "Any difficulty" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "unknown", label: "Unrated" },
];

const CLAIMED_OPTIONS: { value: ClaimedFilter; label: string }[] = [
  { value: "any", label: "All" },
  { value: "open", label: "Open" },
  { value: "claimed", label: "Claimed" },
];

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  unknown: "Unrated",
};

const DIFFICULTY_DOT: Record<Difficulty, string> = {
  beginner: "bg-brand-accent",
  intermediate: "bg-amber-500",
  advanced: "bg-red-500",
  unknown: "bg-muted-foreground",
};

export const Route = createFileRoute("/_layout/issues")({
  head: () => ({
    meta: [
      { title: "Open issues | NEAR Builders" },
      {
        name: "description",
        content: "Browse open issues from NEAR Builders repositories and claim work to contribute.",
      },
    ],
  }),
  component: IssuesPage,
});

interface RepoIssueClaim {
  id: string;
  nearAccount: string;
  claimedAt: string;
  expiresAt: string;
  prUrl: string | null;
  status: "active" | "submitted" | "merged";
}

interface RepoIssue {
  repoOwner: string;
  repoName: string;
  number: number;
  title: string;
  body: string | null;
  htmlUrl: string;
  state: "open" | "closed";
  labels: { name: string; color: string | null; description: string | null }[];
  difficulty: Difficulty;
  author: { login: string; avatarUrl: string | null; htmlUrl: string | null } | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  claim: RepoIssueClaim | null;
}

interface IssuesResponse {
  data: RepoIssue[];
  meta: {
    total: number;
    hasMore: boolean;
    nextCursor: string | null;
    repos: { owner: string; name: string; htmlUrl: string }[];
    labels: string[];
  };
}

function IssuesPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const nearAccountId = auth.near.getAccountId();
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [claimedFilter, setClaimedFilter] = useState<ClaimedFilter>("any");
  const [label, setLabel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<RepoIssue | null>(null);

  const issuesQuery = useQuery({
    queryKey: ["issues", { difficulty, claimedFilter, label }],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50, claimed: claimedFilter };
      if (difficulty !== "all") params.difficulty = difficulty;
      if (label !== "all") params.label = label;
      return (await apiClient.issues.listRepoIssues(params)) as IssuesResponse;
    },
    staleTime: 60_000,
  });

  const issues = issuesQuery.data?.data ?? [];
  const repos = issuesQuery.data?.meta.repos ?? [];
  const labels = issuesQuery.data?.meta.labels ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter((issue) => {
      return (
        issue.title.toLowerCase().includes(q) ||
        issue.repoName.toLowerCase().includes(q) ||
        issue.labels.some((l) => l.name.toLowerCase().includes(q))
      );
    });
  }, [issues, search]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">Issues</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Browse open work from NEAR Builders repos and claim what you'd like to tackle.
          </p>
        </div>
        {repos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:justify-end">
            <span className="hidden sm:inline">Tracking</span>
            {repos.map((repo) => (
              <a
                key={`${repo.owner}/${repo.name}`}
                href={repo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground transition-colors hover:border-brand-accent hover:text-brand-accent"
              >
                {repo.owner}/{repo.name}
                <ExternalLink className="size-3" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 py-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search title, repo, or label"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5">
          {CLAIMED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setClaimedFilter(opt.value)}
              className={cn(
                "h-7 px-3 rounded-md text-sm font-semibold cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                claimedFilter === opt.value
                  ? "bg-card dark:bg-accent text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty | "all")}>
          <SelectTrigger
            size="sm"
            className="h-8 w-auto gap-1.5 rounded-lg bg-secondary font-semibold"
            aria-label="Filter by difficulty"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={label} onValueChange={setLabel}>
          <SelectTrigger
            size="sm"
            className="h-8 w-auto gap-1.5 rounded-lg bg-secondary font-semibold"
            aria-label="Filter by label"
          >
            <SelectValue placeholder="Any label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any label</SelectItem>
            {labels.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pb-16">
        {issuesQuery.isLoading ? (
          <div className="flex flex-col border-y border-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border px-3.5 py-3.5">
                <Skeleton className="h-4 w-8 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        ) : issuesQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Could not load issues</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {(issuesQuery.error as Error)?.message ??
                "GitHub may be rate-limited. Please try again in a minute."}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-sm font-semibold text-foreground">Nothing matches your filters</p>
            <p className="text-xs text-muted-foreground">
              Try widening the difficulty, label, or claim filter.
            </p>
          </div>
        ) : (
          <div className="flex flex-col border-y border-border">
            {filtered.map((issue) => (
              <IssueRow
                key={`${issue.repoOwner}/${issue.repoName}#${issue.number}`}
                issue={issue}
                currentNearAccount={nearAccountId ?? null}
                isAuthenticated={isAuthenticated}
                onOpen={() => setSelectedIssue(issue)}
              />
            ))}
          </div>
        )}
      </div>

      <IssueDetailSheet
        issue={selectedIssue}
        open={!!selectedIssue}
        onOpenChange={(open) => !open && setSelectedIssue(null)}
        currentNearAccount={nearAccountId ?? null}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}

function IssueRow({
  issue,
  currentNearAccount,
  isAuthenticated,
  onOpen,
}: {
  issue: RepoIssue;
  currentNearAccount: string | null;
  isAuthenticated: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-3.5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/40"
    >
      <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        #{issue.number}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={issue.difficulty} />
          <span className="truncate text-sm font-semibold text-foreground">{issue.title}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          <span className="font-mono">
            {issue.repoOwner}/{issue.repoName}
          </span>
          <span className="mx-1.5">·</span>
          updated {formatRelative(issue.updatedAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ClaimStatusPill claim={issue.claim} currentNearAccount={currentNearAccount} />
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
          <MessageSquare className="size-3" />
          {issue.commentCount}
        </span>
        {!issue.claim && isAuthenticated && (
          <ArrowUpRight className="hidden size-3.5 text-muted-foreground sm:block" />
        )}
      </div>
    </button>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0 text-[10px] font-semibold text-foreground">
      <span className={cn("size-1.5 rounded-full", DIFFICULTY_DOT[difficulty])} />
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}

function ClaimStatusPill({
  claim,
  currentNearAccount,
}: {
  claim: RepoIssueClaim | null;
  currentNearAccount: string | null;
}) {
  const pill =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap";
  if (!claim) {
    return (
      <span className={cn(pill, "border-border bg-secondary text-muted-foreground")}>
        <span className="size-1.5 rounded-full bg-brand-accent" />
        Open
      </span>
    );
  }
  const isMine = !!currentNearAccount && claim.nearAccount === currentNearAccount.toLowerCase();
  if (claim.status === "merged") {
    return (
      <span
        className={cn(pill, "border-brand-accent-border bg-brand-accent-light text-brand-accent")}
      >
        <Check className="size-2.5" />
        Merged
      </span>
    );
  }
  if (claim.status === "submitted") {
    return (
      <span
        className={cn(pill, "border-brand-accent-border bg-brand-accent-light text-brand-accent")}
      >
        <GitPullRequest className="size-2.5" />
        PR open
      </span>
    );
  }
  if (isMine) {
    return (
      <span
        className={cn(pill, "border-brand-accent-border bg-brand-accent-light text-brand-accent")}
      >
        <UserIcon className="size-2.5" />
        You
      </span>
    );
  }
  return (
    <span className={cn(pill, "border-border bg-secondary text-muted-foreground")}>
      <UserIcon className="size-2.5" />
      {claim.nearAccount}
    </span>
  );
}

function IssueDetailSheet({
  issue,
  open,
  onOpenChange,
  currentNearAccount,
  isAuthenticated,
}: {
  issue: RepoIssue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNearAccount: string | null;
  isAuthenticated: boolean;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [prUrl, setPrUrl] = useState("");

  const claim = issue?.claim ?? null;
  const isMine =
    !!currentNearAccount && !!claim && claim.nearAccount === currentNearAccount.toLowerCase();

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!issue) throw new Error("No issue selected");
      return apiClient.issues.claimIssue({
        repoOwner: issue.repoOwner,
        repoName: issue.repoName,
        issueNumber: issue.number,
      });
    },
    onSuccess: () => {
      toast.success("Issue claimed — you have 7 days to submit a PR");
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issue-claims"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not claim issue");
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      if (!claim) throw new Error("No claim to release");
      return apiClient.issues.releaseIssueClaim({ id: claim.id });
    },
    onSuccess: () => {
      toast.success("Claim released");
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issue-claims"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not release claim");
    },
  });

  const attachPrMutation = useMutation({
    mutationFn: async () => {
      if (!claim) throw new Error("No active claim");
      return apiClient.issues.attachPrToClaim({ id: claim.id, prUrl: prUrl.trim() });
    },
    onSuccess: () => {
      toast.success("PR linked to your claim");
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["issue-claims"] });
      setPrUrl("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not attach PR");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {issue && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-mono">
                  {issue.repoOwner}/{issue.repoName}#{issue.number}
                </span>
                <span>·</span>
                <span>{formatRelative(issue.updatedAt)}</span>
              </div>
              <SheetTitle className="text-left text-lg">{issue.title}</SheetTitle>
              <SheetDescription className="sr-only">
                Issue details and claim controls
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <DifficultyBadge difficulty={issue.difficulty} />
              {issue.labels.map((label) => (
                <Badge
                  key={label.name}
                  variant="secondary"
                  className="rounded-full px-2 py-0.5 text-[10px]"
                >
                  <Tag className="mr-1 size-2.5" />
                  {label.name}
                </Badge>
              ))}
            </div>

            {issue.body && (
              <div className="mt-4 max-h-[220px] overflow-y-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="whitespace-pre-wrap">{issue.body.slice(0, 800)}</p>
                {issue.body.length > 800 && (
                  <p className="mt-2 text-[11px] italic">
                    Truncated — read the full issue on GitHub.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              {claim ? (
                <>
                  <p className="text-xs font-semibold text-foreground">
                    Claimed by{" "}
                    <span className="font-mono text-brand-accent">{claim.nearAccount}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Expires {formatRelative(claim.expiresAt)}
                    {claim.prUrl && (
                      <>
                        {" · "}
                        <a
                          href={claim.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-accent hover:underline"
                        >
                          view PR
                        </a>
                      </>
                    )}
                  </p>
                  {isMine && (
                    <>
                      {!claim.prUrl && (
                        <div className="mt-2 flex flex-col gap-2">
                          <Input
                            placeholder="https://github.com/…/pull/123"
                            value={prUrl}
                            onChange={(e) => setPrUrl(e.target.value)}
                            className="text-xs"
                          />
                          <Button
                            size="sm"
                            disabled={!prUrl.trim() || attachPrMutation.isPending}
                            onClick={() => attachPrMutation.mutate()}
                          >
                            {attachPrMutation.isPending ? "Linking…" : "Link PR"}
                          </Button>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-8 self-start text-xs"
                        disabled={releaseMutation.isPending}
                        onClick={() => releaseMutation.mutate()}
                      >
                        <X className="mr-1 size-3" />
                        Release claim
                      </Button>
                    </>
                  )}
                </>
              ) : isAuthenticated && currentNearAccount ? (
                <Button
                  size="sm"
                  disabled={claimMutation.isPending}
                  onClick={() => claimMutation.mutate()}
                >
                  {claimMutation.isPending ? "Claiming…" : "Claim this issue"}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Connect your NEAR wallet to claim this issue.
                </p>
              )}
            </div>

            <Button asChild size="sm" variant="outline" className="mt-4 w-full justify-center">
              <a href={issue.htmlUrl} target="_blank" rel="noopener noreferrer">
                Open on GitHub
                <ExternalLink className="ml-1 size-3" />
              </a>
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const diffMs = then - Date.now();
    const abs = Math.abs(diffMs);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;
    const past = diffMs < 0;
    const suffix = past ? "ago" : "from now";
    if (abs < minute) return "just now";
    if (abs < hour) return `${Math.round(abs / minute)}m ${suffix}`;
    if (abs < day) return `${Math.round(abs / hour)}h ${suffix}`;
    if (abs < week) return `${Math.round(abs / day)}d ${suffix}`;
    if (abs < month) return `${Math.round(abs / week)}w ${suffix}`;
    if (abs < year) return `${Math.round(abs / month)}mo ${suffix}`;
    return `${Math.round(abs / year)}y ${suffix}`;
  } catch {
    return iso;
  }
}
