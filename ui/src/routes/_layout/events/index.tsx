import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Clock, Lock, MapPin, Plus, Share2, Users } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EventRecord = Awaited<
  ReturnType<ReturnType<typeof useApiClient>["listEvents"]>
>["data"][number];

type EventTab = "upcoming" | "past";
type EventProposalStatus = "pending" | "approved" | "rejected" | "removed";

export const Route = createFileRoute("/_layout/events/")({
  head: () => ({
    meta: [
      { title: "Events | NEAR Builders" },
      { name: "description", content: "Browse NEAR builder events." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const viewerKey = nearAccountId ?? session?.user?.id ?? "anonymous";
  const canCreate = Boolean(session?.user && !session.user.isAnonymous);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<EventTab>("upcoming");

  const eventsQuery = useQuery({
    queryKey: ["events", viewerKey],
    queryFn: () => apiClient.listEvents({ limit: 100 }),
  });

  const events = eventsQuery.data?.data ?? [];
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

  const visibleEvents = tab === "upcoming" ? upcoming : past;
  const monthGroups = useMemo(() => groupByMonth(visibleEvents), [visibleEvents]);

  const copyEventLink = (event: EventRecord) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/events/${event.id}` : "";
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

      <div className="mt-6 flex items-center gap-2">
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

      <div className="mt-8">
        {eventsQuery.isLoading ? (
          <TimelineSkeleton />
        ) : visibleEvents.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="grid grid-cols-[2.5rem_1.25rem_1fr] sm:grid-cols-[3rem_1.5rem_1fr]">
            {monthGroups.map((group, groupIndex) => (
              <Fragment key={group.key}>
                <div aria-hidden />
                <Spine />
                <div className={cn("pb-3", groupIndex > 0 && "pt-7")}>
                  <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {group.label}
                  </h2>
                </div>

                {group.events.map((event) => (
                  <Fragment key={event.id}>
                    <div className="flex flex-col items-end pr-1 pt-2 text-right sm:pr-2">
                      <span className="text-lg font-bold leading-none text-foreground">
                        {formatDayNumber(event)}
                      </span>
                      <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {formatWeekday(event)}
                      </span>
                    </div>
                    <Spine isPast={tab === "past"} withDot />
                    <div className="pb-4">
                      <EventCard
                        event={event}
                        proposalStatus={eventProposalStatuses.get(event.id)}
                        copied={copied === event.id}
                        onShare={copyEventLink}
                      />
                    </div>
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Spine({ isPast, withDot }: { isPast?: boolean; withDot?: boolean }) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      {withDot && (
        <span
          className={cn(
            "absolute left-1/2 top-2.5 size-2.5 -translate-x-1/2 rounded-full ring-4 ring-background",
            isPast ? "bg-muted-foreground/40" : "bg-brand-accent",
          )}
        />
      )}
    </div>
  );
}

function EventCard({
  event,
  proposalStatus,
  copied,
  onShare,
}: {
  event: EventRecord;
  proposalStatus?: EventProposalStatus;
  copied: boolean;
  onShare: (event: EventRecord) => void;
}) {
  const isCancelled = event.status === "cancelled";
  const status = getEventCardStatus(event, proposalStatus);
  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="group relative block rounded-lg border border-border bg-card px-4 py-3.5 transition-all duration-200 hover:shadow-lg sm:px-5 sm:py-4"
    >
      <span
        className={cn(
          "absolute right-4 top-3 shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5 sm:right-5",
          status.className,
        )}
      >
        {status.label}
      </span>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pr-24">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
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
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={12} className="shrink-0" />
              {formatTimeRange(event)}
            </span>
            {event.location && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users size={12} className="shrink-0" />
              {event.participantCount}
            </span>
          </div>
          {event.description && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onShare(event);
          }}
          className={cn(
            "shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100",
            copied && "text-brand-accent opacity-100",
          )}
          aria-label="Copy event link"
        >
          <Share2 size={14} />
        </button>
      </div>
    </Link>
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
      className: "border-yellow-500/20 bg-yellow-500/5 text-yellow-700 dark:text-yellow-300/90",
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
  return (
    <div className="grid grid-cols-[2.5rem_1.25rem_1fr] sm:grid-cols-[3rem_1.5rem_1fr]">
      <div aria-hidden />
      <Spine />
      <div className="pb-3">
        <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Fragment key={i}>
          <div className="flex flex-col items-end pr-1 pt-2 text-right sm:pr-2">
            <div className="h-5 w-6 animate-pulse rounded bg-secondary" />
          </div>
          <Spine withDot />
          <div className="pb-4">
            <div className="rounded-lg border border-border bg-card px-4 py-4">
              <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
              <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

type MonthGroup = {
  key: string;
  label: string;
  events: EventRecord[];
};

function groupByMonth(events: EventRecord[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const index = new Map<string, MonthGroup>();
  for (const event of events) {
    const start = new Date(event.startAt);
    const key = `${start.getFullYear()}-${start.getMonth()}`;
    let group = index.get(key);
    if (!group) {
      group = {
        key,
        label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        events: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}

function formatDayNumber(event: EventRecord) {
  return new Date(event.startAt).toLocaleDateString(undefined, { day: "numeric" });
}

function formatWeekday(event: EventRecord) {
  return new Date(event.startAt).toLocaleDateString(undefined, { weekday: "short" });
}

function formatTimeRange(event: EventRecord) {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!end) return startLabel;
  return `${startLabel} - ${end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
