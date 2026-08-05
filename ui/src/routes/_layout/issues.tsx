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

const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  beginner: "bg-brand-green/10 text-brand-green border-brand-green/30",
  intermediate: "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30",
  advanced: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  unknown: "Unrated",
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
  const [claimedFilter, setClaimedFilter] = useState<ClaimedFilter>("open");
  const [label, setLabel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<RepoIssue | null>(null);

  const issuesQuery = useQuery({
    queryKey: ["issues", { difficulty, claimedFilter, label }],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50, claimed: claimedFilter };
      if (difficulty !== "all") params.difficulty = difficulty;
      if (label !== "all") params.label = label;
      return (await apiClient.listRepoIssues(params)) as IssuesResponse;
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <IssuesHeader repos={repos} />

      <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search title, repo, or label"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty | "all")}>
          <SelectTrigger className="min-w-[160px]">
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
          <SelectTrigger className="min-w-[160px]">
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
        <div className="flex rounded-md border border-border bg-card p-0.5">
          {CLAIMED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setClaimedFilter(opt.value)}
              className={cn(
                "min-w-[70px] rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                claimedFilter === opt.value
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {issuesQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : issuesQuery.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm font-semibold text-foreground">Could not load issues</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(issuesQuery.error as Error)?.message ??
                "GitHub may be rate-limited. Please try again in a minute."}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-sm font-semibold text-foreground">Nothing matches your filters</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try widening the difficulty, label, or claim filter.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((issue) => (
              <li key={`${issue.repoOwner}/${issue.repoName}#${issue.number}`}>
                <IssueRow
                  issue={issue}
                  currentNearAccount={nearAccountId ?? null}
                  isAuthenticated={isAuthenticated}
                  onOpen={() => setSelectedIssue(issue)}
                />
              </li>
            ))}
          </ul>
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

function IssuesHeader({ repos }: { repos: { owner: string; name: string; htmlUrl: string }[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Contribute
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Open issues
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Browse open work from NEAR Builders repositories. Claim an issue to signal you are working
          on it, then link your pull request when you open it.
        </p>
      </div>
      {repos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Tracking:</span>
          {repos.map((repo) => (
            <a
              key={`${repo.owner}/${repo.name}`}
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-xs text-foreground hover:border-brand-cyan/40 hover:text-brand-cyan"
            >
              {repo.owner}/{repo.name}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}
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
      className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand-cyan/30 hover:bg-secondary/40 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono">
              {issue.repoOwner}/{issue.repoName}#{issue.number}
            </span>
            <span>·</span>
            <span>{formatRelative(issue.updatedAt)}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-foreground sm:text-base">
            {issue.title}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <DifficultyBadge difficulty={issue.difficulty} />
            {issue.labels.slice(0, 4).map((label) => (
              <Badge
                key={label.name}
                variant="secondary"
                className="rounded-full px-2 py-0.5 text-[10px]"
              >
                {label.name}
              </Badge>
            ))}
            {issue.labels.length > 4 && (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                +{issue.labels.length - 4}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ClaimStatusPill claim={issue.claim} currentNearAccount={currentNearAccount} />
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {issue.commentCount}
            </span>
            {!issue.claim && isAuthenticated && (
              <span className="inline-flex items-center gap-1 text-brand-cyan">
                Claim
                <ArrowUpRight className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        DIFFICULTY_BADGE[difficulty],
      )}
    >
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
  if (!claim) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Open
      </span>
    );
  }
  const isMine = !!currentNearAccount && claim.nearAccount === currentNearAccount.toLowerCase();
  if (claim.status === "merged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold text-brand-green">
        <Check className="h-2.5 w-2.5" />
        Merged
      </span>
    );
  }
  if (claim.status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-brand-cyan">
        <GitPullRequest className="h-2.5 w-2.5" />
        PR open
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        isMine
          ? "border-brand-accent/40 bg-brand-accent-light text-brand-accent"
          : "border-border bg-secondary text-muted-foreground",
      )}
    >
      <UserIcon className="h-2.5 w-2.5" />
      {isMine ? "You" : claim.nearAccount}
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
      return apiClient.claimIssue({
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
      return apiClient.releaseIssueClaim({ id: claim.id });
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
      return apiClient.attachPrToClaim({ id: claim.id, prUrl: prUrl.trim() });
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
                  <Tag className="mr-1 h-2.5 w-2.5" />
                  {label.name}
                </Badge>
              ))}
            </div>

            {issue.body && (
              <div className="mt-4 max-h-[220px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
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
                    <span className="font-mono text-brand-cyan">{claim.nearAccount}</span>
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
                          className="text-brand-cyan hover:underline"
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
                        <X className="mr-1 h-3 w-3" />
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
                <ExternalLink className="ml-1 h-3 w-3" />
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
    let value: string;
    if (abs < minute) value = "just now";
    else if (abs < hour) value = `${Math.round(abs / minute)}m ${suffix}`;
    else if (abs < day) value = `${Math.round(abs / hour)}h ${suffix}`;
    else if (abs < week) value = `${Math.round(abs / day)}d ${suffix}`;
    else if (abs < month) value = `${Math.round(abs / week)}w ${suffix}`;
    else if (abs < year) value = `${Math.round(abs / month)}mo ${suffix}`;
    else value = `${Math.round(abs / year)}y ${suffix}`;
    return value === "just now" ? value : value;
  } catch {
    return iso;
  }
}
