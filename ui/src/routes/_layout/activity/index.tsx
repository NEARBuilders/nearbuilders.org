import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, ArrowDownUp, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sessionQueryOptions, useApiClient, useAuthClient, useOrpc } from "@/app";
import { NearProfile } from "@/components/near-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { VoteButton } from "@/components/ui/vote-button";
import {
  type ActivityEvent,
  type ActivityFeedPage,
  activityFeedQueryOptions,
  activityKeys,
  readActivityPayload,
} from "@/lib/queries/activity";
import { upvoteCountsOptions, userVotesOptions } from "@/lib/queries/builders";
import { formatRelativeTime } from "@/lib/queries/notifications";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | "manual" | "nearcatalog";
type TypeFilter = "all" | "upload" | "claim";
type ActivitySort = "recent" | "endorsed";

type FeedData = { pages: ActivityFeedPage[]; pageParams: (string | undefined)[] };
type CountsMap = Record<string, { entityId: string; totalCount: number }>;
type VotesMap = Record<string, { entityId: string; hasUpvote: boolean }>;

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "nearcatalog", label: "NearCatalog" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upload", label: "Upload" },
  { value: "claim", label: "Claim" },
];

export const Route = createFileRoute("/_layout/activity/")({
  loader: ({ context }) => {
    const { queryClient, apiClient } = context;
    void queryClient.prefetchInfiniteQuery(activityFeedQueryOptions(apiClient, {}));
  },
  head: () => ({
    meta: [
      { title: "Activity | NEAR Builders" },
      {
        name: "description",
        content: "Browse and endorse contributions across the NEAR Builders ecosystem.",
      },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const apiClient = useApiClient();
  const orpc = useOrpc();
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const observerRef = useRef<IntersectionObserver | null>(null);

  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);
  const userId = session?.user?.id;

  const [source, setSource] = useState<SourceFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<ActivitySort>("recent");

  const filters = useMemo(
    () => ({
      source: source === "all" ? undefined : source,
      type: type === "all" ? undefined : type,
    }),
    [source, type],
  );
  const feedKey = useMemo(() => activityKeys.feed(filters), [filters]);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(activityFeedQueryOptions(apiClient, filters));

  const events = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);

  const { data: countsData } = useQuery(upvoteCountsOptions(apiClient, eventIds));
  const { data: votesData } = useQuery(userVotesOptions(apiClient, eventIds, isAuthenticated));
  const counts = (countsData ?? {}) as CountsMap;
  const voteMap = (votesData ?? {}) as VotesMap;

  const sortedEvents = useMemo(() => {
    if (sort === "endorsed") {
      return [...events].sort(
        (a, b) => (counts[b.id]?.totalCount ?? 0) - (counts[a.id]?.totalCount ?? 0),
      );
    }
    return events;
  }, [events, sort, counts]);

  const { data: latestEvent } = useQuery(
    orpc.subscribeActivity.experimental_liveOptions({ input: filters, retry: true }),
  );

  useEffect(() => {
    if (!latestEvent) return;
    queryClient.setQueryData(feedKey, (old: FeedData | undefined) => {
      if (!old?.pages.length) return old;
      const exists = old.pages.some((page) => page.data.some((e) => e.id === latestEvent.id));
      if (exists) return old;
      const [first, ...rest] = old.pages;
      const next: ActivityFeedPage = {
        data: [latestEvent as ActivityEvent, ...first.data],
        meta: { ...first.meta, total: first.meta.total + 1 },
      };
      return { ...old, pages: [next, ...rest] };
    });
  }, [latestEvent, queryClient, feedKey]);

  const { data: latestVote } = useQuery(
    orpc.subscribeUpvotes.experimental_liveOptions({ retry: true }),
  );

  useEffect(() => {
    if (!latestVote) return;
    const { entityId, totalCount, type: voteType } = latestVote;
    if (!eventIds.includes(entityId)) return;
    queryClient.setQueryData(["upvoteCounts", eventIds], (old: CountsMap | undefined) => ({
      ...old,
      [entityId]: { entityId, totalCount },
    }));
    if (userId && latestVote.userId === userId) {
      queryClient.setQueryData(["userVotes", eventIds], (old: VotesMap | undefined) => ({
        ...old,
        [entityId]: { entityId, hasUpvote: voteType === "upvote" },
      }));
    }
  }, [latestVote, queryClient, eventIds, userId]);

  const upvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.upvote({ entityId }),
    onSuccess: (result) => {
      queryClient.setQueryData(["upvoteCounts", eventIds], (old: CountsMap | undefined) => ({
        ...old,
        [result.entityId]: { entityId: result.entityId, totalCount: result.totalCount },
      }));
      queryClient.setQueryData(["userVotes", eventIds], (old: VotesMap | undefined) => ({
        ...old,
        [result.entityId]: { entityId: result.entityId, hasUpvote: true },
      }));
    },
  });

  const downvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.downvote({ entityId }),
    onSuccess: (result) => {
      queryClient.setQueryData(["upvoteCounts", eventIds], (old: CountsMap | undefined) => ({
        ...old,
        [result.entityId]: { entityId: result.entityId, totalCount: result.totalCount },
      }));
      queryClient.setQueryData(["userVotes", eventIds], (old: VotesMap | undefined) => ({
        ...old,
        [result.entityId]: { entityId: result.entityId, hasUpvote: false },
      }));
    },
  });

  const runVote = (direction: "up" | "down", entityId: string) => {
    if (!isAuthenticated) {
      void navigate({ to: "/login", search: { redirect: pathname } });
      return;
    }
    if (direction === "up") upvoteMutation.mutate(entityId);
    else downvoteMutation.mutate(entityId);
  };

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasNextPage || isFetchingNextPage) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      });
      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">Activity</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          A live feed of contributions across the NEAR Builders ecosystem. Endorse the work you
          value.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Source</span>
          <SegmentedFilter options={SOURCE_OPTIONS} value={source} onChange={setSource} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <SegmentedFilter options={TYPE_OPTIONS} value={type} onChange={setType} />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as ActivitySort)}>
          <SelectTrigger
            size="sm"
            className="h-8 w-auto gap-1.5 rounded-lg bg-secondary font-semibold"
            aria-label="Sort activity"
          >
            <ArrowDownUp size={13} className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="endorsed">Most Endorsed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ActivityCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <p className="text-lg font-semibold text-foreground mb-1">Unable to load activity</p>
          <p className="text-sm text-muted-foreground">
            The activity feed is temporarily unavailable. Please try again later.
          </p>
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-4">
            <Activity size={22} />
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">No activity yet</p>
          <p className="text-sm text-muted-foreground max-w-[280px]">
            Contributions will appear here as builders share their work.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {sortedEvents.map((event) => (
              <ActivityCard
                key={event.id}
                event={event}
                count={counts[event.id]?.totalCount ?? 0}
                hasUpvote={voteMap[event.id]?.hasUpvote === true}
                isUpvoting={upvoteMutation.isPending && upvoteMutation.variables === event.id}
                isDownvoting={downvoteMutation.isPending && downvoteMutation.variables === event.id}
                onUpvote={() => runVote("up", event.id)}
                onDownvote={() => runVote("down", event.id)}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="flex justify-center py-8">
            {isFetchingNextPage && (
              <div className="size-5 animate-spin rounded-full border-2 border-border border-t-transparent" />
            )}
            {hasNextPage && !isFetchingNextPage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fetchNextPage()}
                className="text-muted-foreground font-semibold"
              >
                <ChevronDown size={14} />
                Load more
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-7 px-3 rounded-md text-sm font-semibold cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            value === opt.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const SOURCE_BADGE_CLASS: Record<string, string> = {
  manual: "border-brand-green/30 bg-brand-green/10 text-foreground",
  nearcatalog: "border-brand-cyan/30 bg-brand-cyan/10 text-foreground",
  github: "border-brand-accent/30 bg-brand-accent-light text-foreground",
};

function SourceBadge({ source }: { source: string }) {
  const key = source.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
        SOURCE_BADGE_CLASS[key] ?? "border-border bg-muted text-foreground",
      )}
    >
      {source}
    </Badge>
  );
}

function ActivityCard({
  event,
  count,
  hasUpvote,
  isUpvoting,
  isDownvoting,
  onUpvote,
  onDownvote,
}: {
  event: ActivityEvent;
  count: number;
  hasUpvote: boolean;
  isUpvoting: boolean;
  isDownvoting: boolean;
  onUpvote: () => void;
  onDownvote: () => void;
}) {
  const payload = useMemo(() => readActivityPayload(event.payload), [event.payload]);

  return (
    <div className="bg-card border border-border rounded-lg px-5 py-4 sm:px-6 sm:py-5 flex gap-4 hover:shadow-lg transition-shadow duration-200">
      <div className="flex flex-col items-center shrink-0 gap-0.5 pt-0.5">
        <VoteButton
          icon={<ChevronUp size={16} strokeWidth={2.25} />}
          onClick={onUpvote}
          label="Endorse"
          disabled={isUpvoting}
          active={hasUpvote}
          activeColor="text-brand-accent"
          size="compact"
        />
        <span className="min-w-[24px] text-center text-xs font-bold leading-none text-foreground tabular-nums">
          {count}
        </span>
        <VoteButton
          icon={<ChevronDown size={16} strokeWidth={2.25} />}
          onClick={onDownvote}
          label="Remove endorsement"
          disabled={isDownvoting}
          active={false}
          activeColor="text-destructive"
          size="compact"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source={event.source} />
          <Badge
            variant="secondary"
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
          >
            {event.type}
          </Badge>
          {event.verified && (
            <Badge
              variant="success"
              className="gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            >
              <CheckCircle2 size={11} />
              Verified
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>

        <div className="mt-2">
          <NearProfile accountId={event.actor} variant="badge" className="w-auto" />
        </div>

        {payload.title && (
          <h3 className="mt-2 text-base font-semibold text-foreground leading-snug">
            {payload.title}
          </h3>
        )}

        <div className="mt-1 flex gap-3">
          {payload.description && (
            <p className="text-sm text-muted-foreground line-clamp-3 flex-1 min-w-0">
              {payload.description}
            </p>
          )}
          {payload.mediaUrl && (
            <img
              src={payload.mediaUrl}
              alt={payload.title ?? "Activity media"}
              className="size-16 rounded-md object-cover border border-border shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>

        {payload.tags && payload.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {payload.tags.slice(0, 6).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="rounded-full px-1.5 py-0 text-[10px] font-medium"
              >
                {tag}
              </Badge>
            ))}
            {payload.tags.length > 6 && (
              <Badge
                variant="secondary"
                className="rounded-full px-1.5 py-0 text-[10px] font-medium"
              >
                +{payload.tags.length - 6}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg px-5 py-4 sm:px-6 sm:py-5 flex gap-4">
      <div className="flex flex-col items-center gap-1.5 pt-0.5">
        <Skeleton className="size-5" />
        <Skeleton className="h-2.5 w-4" />
        <Skeleton className="size-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}
