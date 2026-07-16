import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Clock, Lock, MapPin, Plus, Share2, Users, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarFilters } from "./-calendar-filters";
import { EventDayGroup, type EventDayGroupData } from "./-event-day-group";
import {
  buildTimelineEvents,
  type EventRecord,
  type EventTab,
  formatEventTimeRange,
  type TimelineEvent,
} from "./-event-sources";
import { LumaEventCard } from "./-luma-event-card";

type EventProposalStatus = "pending" | "approved" | "rejected" | "removed";
const LUMA_QUERY_STALE_TIME_MS = 60 * 1000;

export const Route = createFileRoute("/_layout/events/")({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    const viewerKey = session?.user?.id ?? "anonymous";
    const timeBoundary = new Date().toISOString();

    const prefetches = [
      context.queryClient.prefetchQuery({
        queryKey: ["events", viewerKey],
        queryFn: () => context.apiClient.listEvents({ limit: 100 }),
      }),
      context.queryClient.prefetchQuery({
        queryKey: ["luma-calendars"],
        queryFn: () => context.apiClient.listLumaCalendars(),
      }),
      context.queryClient.prefetchInfiniteQuery({
        queryKey: ["luma-events", "upcoming", timeBoundary],
        queryFn: ({ pageParam }) =>
          context.apiClient.listLumaEvents({
            after: timeBoundary,
            cursor: pageParam ?? undefined,
            limitPerCalendar: 20,
          }),
        initialPageParam: null as string | null,
      }),
      context.queryClient.prefetchQuery({
        queryKey: ["luma-events", "ongoing", timeBoundary],
        queryFn: () =>
          context.apiClient.listLumaEvents({
            before: timeBoundary,
            limitPerCalendar: 50,
          }),
      }),
    ];
    if (session?.user && !session.user.isAnonymous) {
      prefetches.push(
        context.queryClient.prefetchQuery({
          queryKey: ["event-proposals", viewerKey],
          queryFn: () => context.apiClient.getProposals({ pluginId: "events", limit: 100 }),
        }),
      );
    }
    await Promise.all(prefetches);
    return { timeBoundary };
  },
  head: () => ({
    meta: [
      { title: "Events | NEAR Builders" },
      { name: "description", content: "Browse NEAR builder events." },
    ],
  }),
  component: EventsPage,
});

function isCurrentUserOwner(
  ownerId: string | null | undefined,
  user:
    | { id?: string | null; walletAddress?: string | null; role?: string | null }
    | null
    | undefined,
  nearAccountId?: string | null,
) {
  if (!ownerId) return false;
  return [nearAccountId, user?.walletAddress, user?.id].some((candidate) => candidate === ownerId);
}

function EventsPage() {
  const { timeBoundary } = Route.useLoaderData();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const viewerKey = session?.user?.id ?? "anonymous";
  const canCreate = Boolean(session?.user && !session.user.isAnonymous);
  const isAdmin = session?.user?.role === "admin";
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<EventTab>("upcoming");
  const [disabledSourceIds, setDisabledSourceIds] = useState<Set<string>>(() => new Set());

  const eventsQuery = useQuery({
    queryKey: ["events", viewerKey],
    queryFn: () => apiClient.listEvents({ limit: 100 }),
  });

  const events = eventsQuery.data?.data ?? [];
  const lumaCalendarsQuery = useQuery({
    queryKey: ["luma-calendars"],
    queryFn: () => apiClient.listLumaCalendars(),
    staleTime: LUMA_QUERY_STALE_TIME_MS,
  });
  const lumaCalendars = lumaCalendarsQuery.data?.data ?? [];
  const lumaEventsQuery = useInfiniteQuery({
    queryKey: ["luma-events", tab, timeBoundary],
    queryFn: ({ pageParam }) =>
      apiClient.listLumaEvents({
        ...(tab === "upcoming" ? { after: timeBoundary } : { before: timeBoundary }),
        cursor: pageParam ?? undefined,
        limitPerCalendar: 20,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: lumaCalendars.length > 0,
    staleTime: LUMA_QUERY_STALE_TIME_MS,
  });
  const lumaOngoingEventsQuery = useQuery({
    queryKey: ["luma-events", "ongoing", timeBoundary],
    queryFn: () => apiClient.listLumaEvents({ before: timeBoundary, limitPerCalendar: 50 }),
    enabled: lumaCalendars.length > 0 && tab === "upcoming",
    staleTime: LUMA_QUERY_STALE_TIME_MS,
  });
  const lumaEvents = useMemo(
    () => [
      ...(tab === "upcoming" ? (lumaOngoingEventsQuery.data?.data ?? []) : []),
      ...(lumaEventsQuery.data?.pages.flatMap((page) => page.data) ?? []),
    ],
    [lumaEventsQuery.data?.pages, lumaOngoingEventsQuery.data?.data, tab],
  );
  const eventProposalsQuery = useQuery({
    queryKey: ["event-proposals", viewerKey],
    queryFn: () => apiClient.getProposals({ pluginId: "events", limit: 100 }),
    enabled: canCreate,
  });
  const eventProposalStatuses = useMemo(() => {
    const statuses = new Map<string, EventProposalStatus>();
    for (const proposal of eventProposalsQuery.data?.data ?? []) {
      statuses.set(proposal.entityId, proposal.reviewStatus as EventProposalStatus);
    }
    return statuses;
  }, [eventProposalsQuery.data?.data]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: EventRecord[] = [];
    const pa: EventRecord[] = [];
    for (const event of events) {
      const ends = new Date(event.endAt ?? event.startAt).getTime();
      if (ends >= now) up.push(event);
      else pa.push(event);
    }
    up.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    pa.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    return { upcoming: up, past: pa };
  }, [events]);

  const visibleEvents = useMemo(
    () =>
      buildTimelineEvents(
        tab === "upcoming" ? upcoming : past,
        lumaEvents,
        disabledSourceIds,
        tab,
        timeBoundary,
      ),
    [disabledSourceIds, lumaEvents, past, tab, timeBoundary, upcoming],
  );
  const dayGroups = useMemo(() => groupByDay(visibleEvents), [visibleEvents]);
  const isLumaInitialLoading =
    lumaCalendarsQuery.isLoading ||
    (lumaCalendars.length > 0 &&
      (lumaEventsQuery.isLoading || (tab === "upcoming" && lumaOngoingEventsQuery.isLoading)));

  const toggleSource = (sourceId: string) => {
    setDisabledSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };

  const copyEventLink = (event: EventRecord) => {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/events/${event.slug}` : "";
    navigator.clipboard.writeText(url).then(() => {
      setCopied(event.id);
      toast.success("Link copied");
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Events</h1>
        {canCreate ? (
          <Button asChild size="sm">
            <Link to="/events/new">
              <Plus size={14} />
              New
            </Link>
          </Button>
        ) : (
          <Button size="sm" disabled>
            <Plus size={14} />
            New
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(
            [
              ["upcoming", "Upcoming"],
              ["past", "Past"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "h-8 rounded-xl border px-3 text-sm font-semibold transition-all duration-150",
                tab === value
                  ? "border-brand-accent bg-brand-accent-light text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {lumaCalendars.length > 0 && (
          <CalendarFilters
            calendars={lumaCalendars}
            disabledSourceIds={disabledSourceIds}
            onToggle={toggleSource}
          />
        )}
      </div>

      {(lumaCalendarsQuery.data?.unavailableCount ?? 0) > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {lumaCalendarsQuery.data?.unavailableCount} configured Luma calendar could not be loaded.
        </p>
      )}

      <div className="mt-8">
        {eventsQuery.isLoading ? (
          <TimelineSkeleton />
        ) : visibleEvents.length === 0 && !isLumaInitialLoading ? (
          <EmptyState tab={tab} />
        ) : (
          <div>
            {dayGroups.map((group) => (
              <EventDayGroup key={group.key} group={group} tab={tab}>
                {group.events.map((event) =>
                  event.source === "internal" ? (
                    <EventCard
                      key={event.key}
                      event={event}
                      proposalStatus={eventProposalStatuses.get(event.id)}
                      showStatus={
                        isAdmin || isCurrentUserOwner(event.ownerId, session?.user, nearAccountId)
                      }
                      copied={copied === event.id}
                      onShare={copyEventLink}
                    />
                  ) : (
                    <LumaEventCard key={event.key} event={event} />
                  ),
                )}
              </EventDayGroup>
            ))}
            {isLumaInitialLoading && <LumaEventsSkeleton />}
          </div>
        )}
      </div>

      {lumaEventsQuery.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={lumaEventsQuery.isFetchingNextPage}
            onClick={() => lumaEventsQuery.fetchNextPage()}
          >
            {lumaEventsQuery.isFetchingNextPage ? "Loading…" : "Load more calendar events"}
          </Button>
        </div>
      )}

      {(lumaEventsQuery.data?.pages.at(-1)?.unavailableCalendarIds.length ?? 0) > 0 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Some calendar events are temporarily unavailable.
        </p>
      )}
    </div>
  );
}

function EventCard({
  event,
  proposalStatus,
  showStatus,
  copied,
  onShare,
}: {
  event: EventRecord;
  proposalStatus?: EventProposalStatus;
  showStatus: boolean;
  copied: boolean;
  onShare: (event: EventRecord) => void;
}) {
  const isCancelled = event.status === "cancelled";
  const status = getEventCardStatus(event, proposalStatus);
  return (
    <div className="group relative rounded-lg border border-border bg-card transition-all duration-200 hover:shadow-lg">
      <div className="absolute right-4 top-3 z-10 flex items-center gap-1 sm:right-5">
        {showStatus && (
          <span
            className={cn(
              "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5",
              status.className,
            )}
          >
            {status.label}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onShare(event);
          }}
          className={cn(
            "shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
            copied && "text-brand-accent opacity-100",
          )}
          aria-label="Copy event link"
        >
          <Share2 size={14} />
        </button>
      </div>
      <Link
        to="/events/$slug"
        params={{ slug: event.slug }}
        className="block px-4 py-3.5 sm:px-5 sm:py-4"
      >
        <div className="flex items-start gap-2">
          <div className={cn("min-w-0 flex-1", showStatus ? "pr-28 sm:pr-32" : "pr-10")}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock size={12} className="shrink-0" />
                {formatEventTimeRange(event)}
              </span>
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "truncate text-base font-semibold text-foreground",
                  isCancelled && "text-muted-foreground line-through",
                )}
              >
                {event.title}
              </span>
              {event.visibility === "private" && (
                <Lock size={12} className="shrink-0 text-muted-foreground" />
              )}
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              {event.location ? (
                <MapPin size={12} className="shrink-0" />
              ) : (
                <Video size={12} className="shrink-0" />
              )}
              <span className="truncate">{event.location ?? "Virtual"}</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={12} className="shrink-0" />
              {event.participantCount}
            </div>
            {event.description && (
              <p className="mt-1.5 line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

function getEventCardStatus(event: EventRecord, proposalStatus?: EventProposalStatus) {
  if (event.status === "cancelled") {
    return {
      label: "Cancelled",
      className: "border-destructive/20 bg-destructive/5 text-destructive",
    };
  }
  if (proposalStatus === "pending") {
    return {
      label: "Pending",
      className: "border-border bg-secondary/60 text-muted-foreground",
    };
  }
  if (proposalStatus === "rejected") {
    return {
      label: "Rejected",
      className: "border-destructive/20 bg-destructive/5 text-destructive",
    };
  }
  if (proposalStatus === "approved") {
    return {
      label: "Approved",
      className: "border-brand-green/20 bg-brand-green/5 text-brand-green",
    };
  }
  if (event.visibility === "private") {
    return {
      label: "Private",
      className: "border-border bg-secondary/60 text-muted-foreground",
    };
  }
  return {
    label: "Public",
    className: "border-brand-accent/20 bg-brand-accent/5 text-brand-accent",
  };
}

function EmptyState({ tab }: { tab: EventTab }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <CalendarDays size={22} />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          {tab === "upcoming" ? "No upcoming events" : "No past events"}
        </p>
        <p className="mx-auto max-w-[280px] text-sm text-muted-foreground">
          {tab === "upcoming"
            ? "New events will appear here once they are scheduled."
            : "Events that have already happened will show up here."}
        </p>
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return <EventGroupsSkeleton />;
}

function LumaEventsSkeleton() {
  return (
    <div className="mt-4" role="status" aria-label="Loading Luma events" aria-live="polite">
      <EventGroupsSkeleton />
    </div>
  );
}

function EventGroupsSkeleton() {
  return (
    <div aria-hidden>
      {[2, 3, 2].map((eventCount, groupIndex) => (
        <div key={groupIndex} className="relative pb-7 last:pb-0">
          <div className="absolute bottom-0 left-1.5 top-4 w-px bg-border" />
          <div className="absolute left-0 top-4 size-3 animate-pulse rounded-full bg-secondary" />
          <div className="mb-3 ml-6 h-5 w-32 animate-pulse rounded bg-secondary" />
          <div className="ml-6 space-y-3">
            {Array.from({ length: eventCount }, (_, eventIndex) => (
              <div
                key={eventIndex}
                className="flex rounded-lg border border-border bg-card px-4 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
                  <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-secondary" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-secondary" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-secondary" />
                </div>
                <div className="ml-4 size-20 animate-pulse rounded-lg bg-secondary" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByDay(events: TimelineEvent[]): EventDayGroupData[] {
  const groups: EventDayGroupData[] = [];
  const index = new Map<string, EventDayGroupData>();
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  for (const event of events) {
    const start = new Date(event.startAt);
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    let group = index.get(key);
    if (!group) {
      const eventDay = startOfDay(start);
      const isToday = eventDay.getTime() === today.getTime();
      const isTomorrow = eventDay.getTime() === tomorrow.getTime();
      group = {
        key,
        primaryLabel: isToday
          ? "Today"
          : isTomorrow
            ? "Tomorrow"
            : start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        secondaryLabel: start.toLocaleDateString(undefined, { weekday: "long" }),
        events: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
