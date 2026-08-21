import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Award, ChevronLeft, ChevronRight, Trophy, Zap } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useApiClient } from "@/app";
import { NearProfile } from "@/components/near-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedFilter } from "@/components/ui/segmented-filter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LEADERBOARD_PAGE_SIZE,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  leaderboardQueryOptions,
} from "@/lib/queries/activity";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all-time", label: "All time" },
];

export const Route = createFileRoute("/_layout/activity/leaderboard")({
  loader: ({ context }) => {
    const { queryClient, apiClient } = context;
    void queryClient.prefetchQuery(leaderboardQueryOptions(apiClient, "all-time"));
  },
  head: () => ({
    meta: [
      { title: "Leaderboard | NEAR Builders" },
      {
        name: "description",
        content: "The builders contributing most across the NEAR Builders ecosystem.",
      },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const apiClient = useApiClient();
  const [period, setPeriod] = useState<LeaderboardPeriod>("all-time");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError } = useQuery(leaderboardQueryOptions(apiClient, period));

  const entries = data ?? [];
  const pageCount = Math.max(1, Math.ceil(entries.length / LEADERBOARD_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * LEADERBOARD_PAGE_SIZE;
  const pageEntries = useMemo(
    () => entries.slice(start, start + LEADERBOARD_PAGE_SIZE),
    [entries, start],
  );

  const changePeriod = (next: LeaderboardPeriod) => {
    setPeriod(next);
    setPage(0);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">Leaderboard</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            The builders contributing most across the NEAR Builders ecosystem, ranked by endorsement
            score.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to="/activity">
            <Activity size={14} />
            Activity feed
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Period</span>
        <SegmentedFilter
          options={PERIOD_OPTIONS}
          value={period}
          onChange={changePeriod}
          ariaLabel="Leaderboard period"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <LeaderboardRowSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <p className="text-lg font-semibold text-foreground mb-1">Unable to load leaderboard</p>
          <p className="text-sm text-muted-foreground">
            The leaderboard is temporarily unavailable. Please try again later.
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-4">
            <Trophy size={22} />
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">No activity recorded</p>
          <p className="text-sm text-muted-foreground max-w-[280px]">
            Rankings will appear here as builders contribute across the ecosystem.
          </p>
        </div>
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {pageEntries.map((entry, i) => (
              <LeaderboardRow key={entry.actor} entry={entry} rank={start + i + 1} />
            ))}
          </ol>

          {pageCount > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft size={14} />
                Previous
              </Button>
              <span className="text-sm font-medium text-muted-foreground tabular-nums">
                Page {safePage + 1} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  return (
    <li>
      <Link
        to="/builders/$account"
        params={{ account: entry.actor }}
        className="group flex items-center gap-3 sm:gap-4 rounded-lg border border-border bg-card px-4 py-3 sm:px-5 sm:py-4 hover:shadow-lg transition-all duration-200"
      >
        <RankBadge rank={rank} />

        <div className="min-w-0 flex-1">
          <NearProfile accountId={entry.actor} variant="badge" className="w-auto" />
          {entry.topSources.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {entry.topSources.map((source) => (
                <Badge
                  key={source}
                  variant="secondary"
                  className="rounded-full px-2 py-0 text-[10px] font-semibold capitalize"
                >
                  {source}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <Stat icon={<Zap size={13} />} value={entry.eventCount} label="events" />
          <Stat icon={<Award size={13} />} value={entry.endorsementScore} label="score" />
        </div>
      </Link>
    </li>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <div
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-sm font-black tabular-nums",
        rank === 1
          ? "bg-brand-accent text-black"
          : rank === 2
            ? "bg-brand-cyan text-black"
            : rank === 3
              ? "bg-brand-green text-black"
              : "bg-secondary text-muted-foreground",
      )}
    >
      {rank}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {value}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 sm:gap-4 rounded-lg border border-border bg-card px-4 py-3 sm:px-5 sm:py-4">
      <Skeleton className="size-8 rounded-full" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex shrink-0 gap-4 sm:gap-6">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}
