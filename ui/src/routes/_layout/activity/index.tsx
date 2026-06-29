import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownUp, Plus, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { ActivityFeed, type ActivitySort } from "@/components/activity-feed";
import { Button } from "@/components/ui/button";
import { SegmentedFilter } from "@/components/ui/segmented-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { activityFeedQueryOptions } from "@/lib/queries/activity";

type SourceFilter = "all" | "manual" | "nearcatalog";
type TypeFilter = "all" | "upload" | "claim";

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
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

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

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">Activity</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            A live feed of contributions across the NEAR Builders ecosystem. Endorse the work you
            value.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/activity/leaderboard">
              <Trophy size={14} />
              Leaderboard
            </Link>
          </Button>
          {isAuthenticated && (
            <Button asChild size="sm">
              <Link to="/profile/activity">
                <Plus size={14} />
                Add Activity
              </Link>
            </Button>
          )}
        </div>
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

      <TooltipProvider>
        <ActivityFeed filters={filters} sort={sort} />
      </TooltipProvider>
    </div>
  );
}
