import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Activity, ExternalLink, Trophy } from "lucide-react";
import { useApiClient } from "@/app";
import { useProjectActivity } from "@/components/project-activity";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/queries/notifications";

function ContributorList({ projectId }: { projectId: string }) {
  const apiClient = useApiClient();
  const { data: contributors = [] } = useQuery({
    queryKey: ["project-activity-contributors", projectId],
    queryFn: () => apiClient.getProjectActivityContributors({ projectId }),
    staleTime: 60_000,
  });

  if (contributors.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Top contributors</p>
      <ol className="flex flex-wrap gap-2">
        {contributors.map((contributor) => (
          <li
            key={contributor.actor}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs"
          >
            {contributor.rank === 1 ? (
              <Trophy className="size-3.5 text-brand-accent" />
            ) : (
              <span className="font-semibold text-muted-foreground">{contributor.rank}</span>
            )}
            <span className="font-mono text-foreground">{contributor.actor}</span>
            <span className="text-muted-foreground">
              {contributor.score} pts · {contributor.eventCount}{" "}
              {contributor.eventCount === 1 ? "event" : "events"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProjectActivityFeed({ projectId }: { projectId: string }) {
  const apiClient = useApiClient();
  const { data: status } = useProjectActivity(projectId);
  const connected = status?.status === "connected" || status?.status === "tracked";

  const events = useInfiniteQuery({
    queryKey: ["project-activity-events", projectId],
    queryFn: ({ pageParam }) =>
      apiClient.getProjectActivityEvents({ projectId, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: connected,
    staleTime: 30_000,
  });

  if (!status || !connected) return null;

  const items = events.data?.pages.flatMap((page) => page.events) ?? [];
  const activityLink = new URL("/activity", status.activityUrl);
  if (status.sourceId) activityLink.searchParams.set("source", status.sourceId);

  return (
    <section className="border-t border-border pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-12 text-brand-accent">Activity</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Recent activity</h2>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={activityLink.toString()} target="_blank" rel="noreferrer">
            View all on Activity
            <ExternalLink size={12} className="text-muted-foreground" />
          </a>
        </Button>
      </div>

      <div className="mt-4 space-y-5 rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8">
        <ContributorList projectId={projectId} />

        {events.isLoading ? (
          <div className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-border" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-border" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-border" />
          </div>
        ) : events.isError ? (
          <p className="text-sm text-muted-foreground">
            Activity is unavailable right now. Try again shortly.
          </p>
        ) : items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            <Activity className="size-4 shrink-0" />
            Connected. Events will appear here as soon as {status.displayName ?? "this project"}{" "}
            sends them.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-foreground">{event.type}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {event.actor}
                  </span>
                  {event.underReview && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-3xs font-semibold text-muted-foreground">
                      Under review
                    </span>
                  )}
                </div>
                <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">
                  {formatRelativeTime(event.occurredAt)}
                </time>
              </li>
            ))}
          </ul>
        )}

        {events.hasNextPage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={events.isFetchingNextPage}
            onClick={() => events.fetchNextPage()}
          >
            {events.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </section>
  );
}
