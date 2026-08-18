import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { exportProposalTable, type ProposalExportOptions } from "@/lib/export-csv";
import { FilterBar } from "./-filter-bar";
import {
  DASHBOARD_STATUSES,
  type DashboardStatus,
  getProposalTitle,
  type ProposalPluginId,
  type ProposalRecord,
  type ProposalTabSearch,
  titleCase,
} from "./-proposal-dashboard";
import { ProposalReviewSheet } from "./-proposal-review-sheet";
import { ProposalTable, ProposalTableSkeleton } from "./-proposal-table";
import { RecordsState } from "./-records-state";

const STATUS_FILTERS = DASHBOARD_STATUSES.map((status) => ({
  value: status,
  label:
    status === "all"
      ? "All"
      : status === "pending"
        ? "Pending"
        : status.charAt(0).toUpperCase() + status.slice(1),
}));

type Noun = {
  singular: string;
  plural: string;
};

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
  title,
  noun,
  pluginId,
  search,
  actions,
}: {
  title: string;
  noun: Noun;
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

  useEffect(() => {
    if (proposalsQuery.hasNextPage && !proposalsQuery.isFetchingNextPage) {
      void proposalsQuery.fetchNextPage();
    }
  }, [proposalsQuery.fetchNextPage, proposalsQuery.hasNextPage, proposalsQuery.isFetchingNextPage]);

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
  const statusWord = status === "all" ? "total" : status;
  const itemWord = total === 1 ? noun.singular : noun.plural;

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
      <FilterBar
        title={title}
        subtitle={
          proposalsQuery.isLoading
            ? `Loading ${noun.plural}...`
            : `${total} ${statusWord} ${itemWord}`
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: `Search ${noun.plural}`,
          ariaLabel: "Search proposals",
        }}
        filters={{
          options: STATUS_FILTERS,
          value: status,
          onChange: onStatusChange,
          ariaLabel: "Proposal status",
        }}
        exportAction={{
          onClick: () =>
            exportMutation.mutate({
              pluginId,
              reviewStatus: status === "all" || status === "pending" ? undefined : status,
              lifecycleStatus: status === "pending" ? "actionable" : undefined,
              query: query || undefined,
              filenameLabel: pluginId,
            }),
          loading: exportMutation.isPending,
          disabled: proposals.length === 0,
        }}
      />

      <RecordsState
        isLoading={proposalsQuery.isLoading}
        isError={proposalsQuery.isError}
        isEmpty={proposals.length === 0}
        onRetry={() => proposalsQuery.refetch()}
        loadingFallback={<ProposalTableSkeleton />}
        errorTitle={`${titleCase(noun.singular)} could not be loaded`}
        errorBody="Retry the request to continue."
        emptyTitle={`No ${noun.plural}`}
        emptyBody="Try another status or search term."
      >
        <ProposalTable
          proposals={proposals}
          selectedEntityId={selectedItem}
          onSelect={selectProposal}
          onApprove={(proposal) => quickApproveMutation.mutate(proposal)}
          approvingEntityId={
            quickApproveMutation.isPending ? quickApproveMutation.variables?.entityId : undefined
          }
        />
      </RecordsState>

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
