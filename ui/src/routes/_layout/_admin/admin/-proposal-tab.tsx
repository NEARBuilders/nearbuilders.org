import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CircleAlert, Download, Loader2, Rows3, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedFilter } from "@/components/ui/segmented-filter";
import { exportProposalTable, type ProposalExportOptions } from "@/lib/export-csv";
import {
  DASHBOARD_STATUSES,
  type DashboardStatus,
  getProposalTitle,
  type ProposalPluginId,
  type ProposalRecord,
  type ProposalTabSearch,
} from "./-proposal-dashboard";
import { ProposalReviewSheet } from "./-proposal-review-sheet";
import { ProposalTable, ProposalTableSkeleton } from "./-proposal-table";

const STATUS_FILTERS = DASHBOARD_STATUSES.map((status) => ({
  value: status,
  label:
    status === "all"
      ? "All"
      : status === "pending"
        ? "Pending"
        : status.charAt(0).toUpperCase() + status.slice(1),
}));

export function getProposalQueryOptions(
  apiClient: ReturnType<typeof useApiClient>,
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

function resolveSearch(search: ProposalTabSearch) {
  return {
    status: (search.status ?? "all") as DashboardStatus,
    query: search.q ?? "",
    item: search.item,
  };
}

function refreshProposalData(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-proposals"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-proposal-count"] }),
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    queryClient.invalidateQueries({ queryKey: ["events"] }),
    queryClient.invalidateQueries({ queryKey: ["builders"] }),
    queryClient.invalidateQueries({ queryKey: ["catalog-claims"] }),
    queryClient.invalidateQueries({ queryKey: ["activity"] }),
  ]);
}

export type ProposalTabActions = {
  setQuery: (query: string | undefined) => void;
  setStatus: (status: DashboardStatus | undefined) => void;
  setSelectedItem: (item: string | undefined) => void;
};

export function ProposalTab({
  pluginId,
  search,
  actions,
}: {
  pluginId: ProposalPluginId;
  search: ProposalTabSearch;
  actions: ProposalTabActions;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { status, query, item: selectedItem } = resolveSearch(search);
  const [searchInput, setSearchInput] = useState(query);
  const selectedItemRef = useRef<string | undefined>(selectedItem);

  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    const nextQuery = searchInput.trim();
    if (nextQuery === query) return;
    const timer = window.setTimeout(() => {
      actions.setQuery(nextQuery || undefined);
      actions.setSelectedItem(undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [actions, query, searchInput]);

  const proposalsQuery = useInfiniteQuery(
    getProposalQueryOptions(apiClient, pluginId, status, query),
  );

  const proposals = (proposalsQuery.data?.pages.flatMap((page) => page.data) ??
    []) as ProposalRecord[];
  const selectedLoadedProposal = proposals.find((proposal) => proposal.entityId === selectedItem);
  const selectedQuery = useQuery({
    queryKey: ["admin-proposal-selected", pluginId, selectedItem],
    queryFn: () =>
      apiClient.getProposals({
        pluginId,
        entityId: selectedItem!,
        limit: 1,
      }),
    enabled: Boolean(selectedItem) && !selectedLoadedProposal,
  });
  const selectedProposal = selectedLoadedProposal ?? selectedQuery.data?.data[0];
  const total = proposalsQuery.data?.pages[0]?.meta.total ?? 0;

  const exportMutation = useMutation({
    mutationFn: (options: ProposalExportOptions) => exportProposalTable(apiClient, options),
    onSuccess: (count, options) => {
      toast.success(`${count} ${options.filenameLabel} record${count === 1 ? "" : "s"} exported`);
    },
    onError: (error: Error) => toast.error(error.message || "The table could not be exported"),
  });

  const quickApproveMutation = useMutation({
    mutationFn: (proposal: ProposalRecord) =>
      apiClient.approve({
        pluginId: proposal.pluginId,
        entityId: proposal.entityId,
        expectedUpdatedAt: proposal.updatedAt,
      }),
    onSuccess: async (_, proposal) => {
      toast.success(`${getProposalTitle(proposal)} approved`);
      await refreshProposalData(queryClient);
    },
    onError: async (error: Error) => {
      toast.error(error.message || "The proposal could not be approved");
      await refreshProposalData(queryClient);
    },
  });

  const onStatusChange = (nextStatus: DashboardStatus) => {
    actions.setStatus(nextStatus === "all" ? undefined : nextStatus);
    actions.setSelectedItem(undefined);
  };

  const onSelect = (item: string | undefined) => {
    if (selectedItemRef.current === item) return;
    const previousItem = selectedItemRef.current;
    selectedItemRef.current = item;
    try {
      actions.setSelectedItem(item);
    } catch {
      selectedItemRef.current = previousItem;
    }
  };

  const selectProposal = (proposal: ProposalRecord) => onSelect(proposal.entityId);
  const closeSheet = () => onSelect(undefined);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
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
              onChange={onStatusChange}
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
                filenameLabel: pluginId,
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
            selectedEntityId={selectedItem}
            onSelect={selectProposal}
            onApprove={(proposal) => quickApproveMutation.mutate(proposal)}
            approvingEntityId={
              quickApproveMutation.isPending ? quickApproveMutation.variables?.entityId : undefined
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

      <ProposalReviewSheet
        open={Boolean(selectedItem)}
        itemKey={selectedItem}
        proposal={selectedProposal}
        loading={Boolean(selectedItem) && !selectedProposal && selectedQuery.isLoading}
        error={selectedQuery.isError ? selectedQuery.error : undefined}
        onRetry={() => selectedQuery.refetch()}
        onClose={closeSheet}
      />
    </section>
  );
}
