import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  CalendarDays,
  CircleAlert,
  Download,
  FolderKanban,
  Hammer,
  Loader2,
  Rows3,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type ApiClient, useApiClient, useOrpc } from "@/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedFilter } from "@/components/ui/segmented-filter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportProposalTable, type ProposalExportOptions } from "@/lib/export-csv";
import {
  DASHBOARD_STATUSES,
  DASHBOARD_TABS,
  type DashboardStatus,
  type DashboardTab,
  getPluginId,
  getProposalTitle,
  type ProposalPluginId,
  type ProposalRecord,
  parseDashboardSearch,
} from "./-proposal-dashboard";
import { ProposalReviewSheet } from "./-proposal-review-sheet";
import { ProposalTable, ProposalTableSkeleton } from "./-proposal-table";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard")({
  validateSearch: parseDashboardSearch,
  head: () => ({
    meta: [{ title: "Admin Dashboard | NEAR Builders" }],
  }),
  component: AdminDashboard,
});

const STATUS_FILTERS = DASHBOARD_STATUSES.map((status) => ({
  value: status,
  label:
    status === "all"
      ? "All"
      : status === "pending"
        ? "Pending"
        : status.charAt(0).toUpperCase() + status.slice(1),
}));

const TAB_ICONS = {
  builders: Hammer,
  projects: FolderKanban,
  events: CalendarDays,
  activity: Activity,
} satisfies Record<DashboardTab, typeof Hammer>;

function getProposalQueryOptions(
  apiClient: ApiClient,
  pluginId: ProposalPluginId,
  status: DashboardStatus,
  query: string,
) {
  return infiniteQueryOptions({
    queryKey: ["admin-proposals", pluginId, status, query],
    queryFn: ({ pageParam }) =>
      apiClient.getProposals({
        pluginId,
        reviewStatus: status === "all" || status === "pending" ? undefined : status,
        lifecycleStatus: status === "pending" ? "actionable" : undefined,
        query: query || undefined,
        limit: 50,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

function AdminDashboard() {
  const apiClient = useApiClient();
  const orpc = useOrpc();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: DashboardTab = search.tab ?? "builders";
  const status: DashboardStatus = search.status ?? "all";
  const pluginId = getPluginId(tab);
  const query = search.q ?? "";
  const [searchInput, setSearchInput] = useState(query);
  const activeTab = DASHBOARD_TABS.find((item) => item.value === tab) ?? DASHBOARD_TABS[0];
  const selectedItemRef = useRef<string | undefined>(search.item);
  const initialProposalFilters = useRef({ status, query });

  useEffect(() => {
    selectedItemRef.current = search.item;
  }, [search.item]);

  useEffect(() => {
    const initialFilters = initialProposalFilters.current;
    void Promise.all(
      DASHBOARD_TABS.map((item) =>
        queryClient.prefetchInfiniteQuery(
          getProposalQueryOptions(
            apiClient,
            item.pluginId,
            initialFilters.status,
            initialFilters.query,
          ),
        ),
      ),
    );
  }, [apiClient, queryClient]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    const nextQuery = searchInput.trim();
    if (nextQuery === query) return;
    const timer = window.setTimeout(() => {
      void navigate({
        search: (previous) => ({
          ...previous,
          q: nextQuery || undefined,
          item: undefined,
        }),
        replace: true,
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [navigate, query, searchInput]);

  const pendingCountQueries = useQueries({
    queries: DASHBOARD_TABS.map((item) => ({
      queryKey: ["admin-proposal-count", item.pluginId, "pending"],
      queryFn: async () => {
        const result = await apiClient.getProposals({
          pluginId: item.pluginId,
          lifecycleStatus: "actionable",
          limit: 1,
        });
        return result.meta.total;
      },
    })),
  });

  const proposalsQuery = useInfiniteQuery(
    getProposalQueryOptions(apiClient, pluginId, status, query),
  );

  const proposals = (proposalsQuery.data?.pages.flatMap((page) => page.data) ??
    []) as ProposalRecord[];
  const selectedLoadedProposal = proposals.find((proposal) => proposal.entityId === search.item);
  const selectedQuery = useQuery({
    queryKey: ["admin-proposal-selected", pluginId, search.item],
    queryFn: () =>
      apiClient.getProposals({
        pluginId,
        entityId: search.item!,
        limit: 1,
      }),
    enabled: Boolean(search.item) && !selectedLoadedProposal,
  });
  const selectedProposal = selectedLoadedProposal ?? selectedQuery.data?.data[0];
  const total = proposalsQuery.data?.pages[0]?.meta.total ?? 0;
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
    ]);
  }, [latestProposalEvent, queryClient]);

  const exportMutation = useMutation({
    mutationFn: (options: ProposalExportOptions) => exportProposalTable(apiClient, options),
    onSuccess: (count, options) => {
      toast.success(`${count} ${options.filenameLabel} record${count === 1 ? "" : "s"} exported`);
    },
    onError: (error: Error) => toast.error(error.message || "The table could not be exported"),
  });

  const refreshProposalData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-proposals"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-proposal-count"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
      queryClient.invalidateQueries({ queryKey: ["builders"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-claims"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
    ]);

  const quickApproveMutation = useMutation({
    mutationFn: (proposal: ProposalRecord) =>
      apiClient.approve({
        pluginId: proposal.pluginId,
        entityId: proposal.entityId,
        expectedUpdatedAt: proposal.updatedAt,
      }),
    onSuccess: async (_, proposal) => {
      toast.success(`${getProposalTitle(proposal)} approved`);
      await refreshProposalData();
    },
    onError: async (error: Error) => {
      toast.error(error.message || "The proposal could not be approved");
      await refreshProposalData();
    },
  });

  const setTab = (nextTab: DashboardTab) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        tab: nextTab === "builders" ? undefined : nextTab,
        item: undefined,
      }),
    });
  };

  const setStatus = (nextStatus: DashboardStatus) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        status: nextStatus === "all" ? undefined : nextStatus,
        item: undefined,
      }),
    });
  };

  const setSelectedItem = (item: string | undefined) => {
    if (selectedItemRef.current === item) return;
    const previousItem = selectedItemRef.current;
    selectedItemRef.current = item;
    void navigate({
      search: (previous) => ({ ...previous, item }),
      replace: item === undefined,
    }).catch(() => {
      selectedItemRef.current = previousItem;
    });
  };

  const selectProposal = (proposal: ProposalRecord) => setSelectedItem(proposal.entityId);
  const closeSheet = () => setSelectedItem(undefined);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Admin Dashboard
        </h1>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as DashboardTab)} className="gap-0">
        <div className="overflow-x-auto">
          <TabsList aria-label="Proposal type" className="min-w-max">
            {DASHBOARD_TABS.map((item, index) => {
              const Icon = TAB_ICONS[item.value];
              const pendingQuery = pendingCountQueries[index];
              const pendingCount = pendingQuery?.data;
              const pendingCountLoading = pendingQuery?.isLoading;
              const pendingCountError = pendingQuery?.isError;
              return (
                <TabsTrigger key={item.value} value={item.value} className="gap-2 px-4 sm:px-5">
                  <Icon />
                  {item.label}
                  {pendingCountLoading ? (
                    <span className="size-4 animate-pulse rounded-full bg-secondary" aria-hidden />
                  ) : pendingCountError ? (
                    <CircleAlert
                      className="size-3.5 text-destructive"
                      aria-label={`${item.label} pending count unavailable`}
                    />
                  ) : pendingCount && pendingCount > 0 ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {pendingCount}
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        <TabsContent key={tab} value={tab} className="mt-6">
          <section>
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{activeTab.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {proposalsQuery.isLoading
                    ? "Loading records..."
                    : `${total} ${status === "all" ? "total" : status} record${total === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search records"
                    aria-label="Search proposals"
                    className="h-10 pl-8 sm:h-8"
                  />
                </div>
                <div className="max-w-full overflow-x-auto pb-1 [&_button]:h-9 sm:pb-0 sm:[&_button]:h-7">
                  <SegmentedFilter
                    options={[...STATUS_FILTERS]}
                    value={status}
                    onChange={setStatus}
                    ariaLabel="Proposal status"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportMutation.mutate({
                      pluginId,
                      reviewStatus: status === "all" || status === "pending" ? undefined : status,
                      lifecycleStatus: status === "pending" ? "actionable" : undefined,
                      query: query || undefined,
                      filenameLabel: tab,
                    })
                  }
                  disabled={exportMutation.isPending}
                  className="h-10 sm:h-8"
                >
                  {exportMutation.isPending ? <Loader2 className="animate-spin" /> : <Download />}
                  Export CSV
                </Button>
              </div>
            </div>

            {proposalsQuery.isLoading ? (
              <ProposalTableSkeleton />
            ) : proposalsQuery.isError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center">
                <CircleAlert className="mx-auto size-6 text-destructive" />
                <h3 className="mt-3 font-semibold text-foreground">Records could not be loaded</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Retry the request to continue auditing.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  variant="outline"
                  onClick={() => proposalsQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : proposals.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
                <Rows3 className="mx-auto size-6 text-muted-foreground" />
                <h3 className="mt-3 font-semibold text-foreground">
                  No {status === "all" ? "" : status} records
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another status or proposal category.
                </p>
              </div>
            ) : (
              <>
                <ProposalTable
                  proposals={proposals}
                  selectedEntityId={search.item}
                  onSelect={selectProposal}
                  onApprove={(proposal) => quickApproveMutation.mutate(proposal)}
                  approvingEntityId={
                    quickApproveMutation.isPending
                      ? quickApproveMutation.variables?.entityId
                      : undefined
                  }
                />
                {proposalsQuery.hasNextPage && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => proposalsQuery.fetchNextPage()}
                      disabled={proposalsQuery.isFetchingNextPage}
                    >
                      {proposalsQuery.isFetchingNextPage && <Loader2 className="animate-spin" />}
                      Load more records
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <ProposalReviewSheet
        open={Boolean(search.item)}
        itemKey={search.item}
        proposal={selectedProposal}
        loading={Boolean(search.item) && !selectedProposal && selectedQuery.isLoading}
        error={selectedQuery.isError ? selectedQuery.error : undefined}
        onRetry={() => selectedQuery.refetch()}
        onClose={closeSheet}
      />
    </div>
  );
}
