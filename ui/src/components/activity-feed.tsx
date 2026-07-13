import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { sessionQueryOptions, useApiClient, useAuthClient, useOrpc } from "@/app";
import { ActivityCard, ActivityCardSkeleton } from "@/components/activity-card";
import { Button } from "@/components/ui/button";
import {
  type ActivityEvent,
  type ActivityFeedPage,
  type ActivityFilters,
  activityFeedWithProfilesQueryOptions,
  activityKeys,
} from "@/lib/queries/activity";
import { ensureNearProfiles, upvoteCountsOptions, userVotesOptions } from "@/lib/queries/builders";

type FeedData = { pages: ActivityFeedPage[]; pageParams: (string | undefined)[] };
type CountsMap = Record<string, { entityId: string; totalCount: number }>;
type VotesMap = Record<string, { entityId: string; hasUpvote: boolean }>;

export type ActivitySort = "recent" | "endorsed";

export function ActivityFeed({
  filters,
  sort = "recent",
  emptyHint = "Contributions will appear here as builders share their work.",
}: {
  filters: ActivityFilters;
  sort?: ActivitySort;
  emptyHint?: string;
}) {
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

  const feedKey = useMemo(() => activityKeys.feed(filters), [filters]);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(activityFeedWithProfilesQueryOptions(apiClient, auth, queryClient, filters));

  const events = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);

  const { data: countsData } = useQuery({
    ...upvoteCountsOptions(apiClient, eventIds),
    enabled: eventIds.length > 0,
  });
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
    const updateFeed = async () => {
      if (!latestEvent.hiddenAt) {
        await ensureNearProfiles(queryClient, auth, [latestEvent.actor]);
      }
      queryClient.setQueryData(feedKey, (old: FeedData | undefined) => {
        if (!old?.pages.length) return old;
        if (latestEvent.hiddenAt) {
          const pages = old.pages.map((page) => {
            const data = page.data.filter((event) => event.id !== latestEvent.id);
            return {
              ...page,
              data,
              meta: {
                ...page.meta,
                total: Math.max(0, page.meta.total - (data.length === page.data.length ? 0 : 1)),
              },
            };
          });
          return { ...old, pages };
        }
        const exists = old.pages.some((page) => page.data.some((e) => e.id === latestEvent.id));
        if (exists) return old;
        const [first, ...rest] = old.pages;
        const next: ActivityFeedPage = {
          data: [latestEvent as ActivityEvent, ...first.data],
          meta: { ...first.meta, total: first.meta.total + 1 },
        };
        return { ...old, pages: [next, ...rest] };
      });
    };
    void updateFeed();
  }, [latestEvent, queryClient, feedKey, auth]);

  const { data: latestVote } = useQuery({
    ...orpc.subscribeUpvotes.experimental_liveOptions({ retry: true }),
  });

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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ActivityCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-4">⚡</div>
        <p className="text-lg font-semibold text-foreground mb-1">Unable to load activity</p>
        <p className="text-sm text-muted-foreground">
          The activity feed is temporarily unavailable. Please try again later.
        </p>
      </div>
    );
  }

  if (sortedEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-4">
          <Activity size={22} />
        </div>
        <p className="text-lg font-semibold text-foreground mb-1">No activity yet</p>
        <p className="text-sm text-muted-foreground max-w-[280px]">{emptyHint}</p>
      </div>
    );
  }

  return (
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
  );
}
