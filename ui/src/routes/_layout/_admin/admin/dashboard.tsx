import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Activity, AtSign, CalendarDays, CircleAlert, FolderKanban, Hammer } from "lucide-react";
import { useEffect } from "react";
import { useApiClient, useOrpc } from "@/app";
import { ADMIN_TABS, type AdminTabConfig, type ProposalPluginId } from "./-proposal-dashboard";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin Dashboard | NEAR Builders" }] }),
  component: AdminDashboardLayout,
});

const TAB_ICONS: Record<(typeof ADMIN_TABS)[number]["icon"], typeof Hammer> = {
  Hammer,
  FolderKanban,
  CalendarDays,
  Activity,
  AtSign,
};

function AdminDashboardLayout() {
  const apiClient = useApiClient();
  const orpc = useOrpc();
  const queryClient = useQueryClient();

  const pendingCounts = useQueries({
    queries: ADMIN_TABS.filter((tab) => tab.pluginId).map((tab) => ({
      queryKey: ["admin-proposal-count", tab.pluginId, "pending"],
      queryFn: async () => {
        const result = await apiClient.getProposals({
          pluginId: tab.pluginId as ProposalPluginId,
          lifecycleStatus: "actionable",
          limit: 1,
        });
        return result.meta.total;
      },
    })),
  });

  const xNominationsMetricsQuery = useQuery({
    queryKey: ["admin-x-nomination-metrics"],
    queryFn: () => apiClient.builders.getXNominationMetrics({}),
    staleTime: 30_000,
  });

  const { data: latestProposalEvent } = useQuery(
    orpc.subscribeProposals.experimental_liveOptions({ input: {}, retry: true }),
  );

  useEffect(() => {
    if (!latestProposalEvent) return;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-proposals"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposal-count"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposal-selected"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposal-audit"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposal-submissions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-x-nomination-metrics"] }),
    ]);
  }, [latestProposalEvent, queryClient]);

  const proposalCountsByPlugin = new Map<ProposalPluginId, number | undefined>();
  pendingCounts.forEach((query, index) => {
    const tab = ADMIN_TABS.filter((entry) => entry.pluginId)[index];
    if (tab?.pluginId) {
      proposalCountsByPlugin.set(tab.pluginId, query.data);
    }
  });

  const xNominationsPendingCount = xNominationsMetricsQuery.data?.pendingReviewCount;
  const xNominationsPendingLoading = xNominationsMetricsQuery.isLoading;
  const xNominationsPendingError = xNominationsMetricsQuery.isError;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Admin Dashboard
        </h1>
      </header>

      <nav aria-label="Admin dashboard sections" className="overflow-x-auto border-b border-border">
        <ul className="flex min-w-max gap-1">
          {ADMIN_TABS.map((tab) => (
            <AdminTabTrigger
              key={tab.value}
              tab={tab}
              proposalCount={tab.pluginId ? proposalCountsByPlugin.get(tab.pluginId) : undefined}
              xNominationsPendingCount={
                tab.value === "x-nominations" ? xNominationsPendingCount : undefined
              }
              xNominationsPendingLoading={
                tab.value === "x-nominations" ? xNominationsPendingLoading : false
              }
              xNominationsPendingError={
                tab.value === "x-nominations" ? xNominationsPendingError : false
              }
            />
          ))}
        </ul>
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}

function AdminTabTrigger({
  tab,
  proposalCount,
  xNominationsPendingCount,
  xNominationsPendingLoading,
  xNominationsPendingError,
}: {
  tab: AdminTabConfig;
  proposalCount: number | undefined;
  xNominationsPendingCount: number | undefined;
  xNominationsPendingLoading: boolean;
  xNominationsPendingError: boolean;
}) {
  const Icon = TAB_ICONS[tab.icon];
  const isProposal = tab.pluginId !== null;
  const countLoading = isProposal ? proposalCount === undefined : xNominationsPendingLoading;
  const countError = isProposal ? false : xNominationsPendingError;
  const count = isProposal ? proposalCount : xNominationsPendingCount;
  return (
    <li>
      <Link
        to={tab.to}
        preload="intent"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5 text-muted-foreground border-transparent hover:text-secondary-foreground [&.active]:text-foreground [&.active]:border-brand-cyan [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      >
        <Icon />
        {tab.label}
        {countLoading ? (
          <span className="size-4 animate-pulse rounded-full bg-secondary" aria-hidden />
        ) : countError ? (
          <CircleAlert
            className="size-3.5 text-destructive"
            aria-label={`${tab.label} pending count unavailable`}
          />
        ) : count && count > 0 ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
