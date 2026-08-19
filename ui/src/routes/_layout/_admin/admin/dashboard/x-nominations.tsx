import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { exportXNominationTable } from "@/lib/export-csv";
import {
  X_NOMINATION_QUEUE_KEY,
  xNominationProposalsOptions,
  xNominationQueueOptions,
} from "@/lib/queries/builders";
import {
  filterXNominationGroups,
  groupXNominationRecords,
  X_QUEUE_STATUS_FILTERS,
  type XNominationFilter,
  type XNominationRecord,
  type XNominationUpdate,
} from "@/lib/x-nomination-queue";
import { FilterBar } from "../-filter-bar";
import { parseNominationsSearch } from "../-nominations-search";
import { titleCase } from "../-proposal-dashboard";
import { RecordsState } from "../-records-state";
import { XNominationReviewSheet } from "../-x-nomination-review-sheet";
import { XNominationTable, XNominationTableSkeleton } from "../-x-nomination-table";

const NOUN = { singular: "X Nomination", plural: "X Nominations" };

export const Route = createFileRoute("/_layout/_admin/admin/dashboard/x-nominations")({
  validateSearch: parseNominationsSearch,
  head: () => ({
    meta: [{ title: "X Nominations · Admin Dashboard | NEAR Builders" }],
  }),
  loader: async ({ context }) => {
    const { queryClient, apiClient } = context;
    await queryClient.prefetchInfiniteQuery(xNominationQueueOptions(apiClient));
  },
  component: XNominationsTab,
});

function XNominationsTab() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const status: XNominationFilter = search.status ?? "all";
  const query = search.q ?? "";
  const [searchInput, setSearchInput] = useState(query);
  const [selectedRow, setSelectedRow] = useState<XNominationRecord>();
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
        }),
        replace: true,
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [navigate, query, searchInput]);

  const queueQuery = useInfiniteQuery(xNominationQueueOptions(apiClient));
  const proposalsQuery = useQuery(xNominationProposalsOptions(apiClient));
  const updateMutation = useMutation({
    mutationFn: (input: XNominationUpdate) =>
      apiClient.builders.updateXNomination({
        nominationId: input.row.id,
        expectedEngagementUpdatedAt: input.row.engagementUpdatedAt,
        action: input.action,
        replyUrl: input.replyUrl,
      }),
    onSuccess: async (updated, input) => {
      setSelectedRow((current) => (current?.id === updated.id ? updated : current));
      toast.success(`X nomination ${input.action.replaceAll("_", " ")}`);
      await queryClient.invalidateQueries({ queryKey: X_NOMINATION_QUEUE_KEY });
    },
    onError: async (error: Error) => {
      toast.error(error.message || "The X nomination could not be updated");
      await queryClient.invalidateQueries({ queryKey: X_NOMINATION_QUEUE_KEY });
    },
  });

  useEffect(() => {
    if (queueQuery.hasNextPage && !queueQuery.isFetchingNextPage) {
      void queueQuery.fetchNextPage();
    }
  }, [queueQuery.fetchNextPage, queueQuery.hasNextPage, queueQuery.isFetchingNextPage]);

  const groups = useMemo(
    () => groupXNominationRecords(queueQuery.data?.pages.flatMap((page) => page.data) ?? []),
    [queueQuery.data],
  );
  const visibleGroups = useMemo(
    () => filterXNominationGroups(groups, status, query),
    [groups, status, query],
  );
  const rows = visibleGroups.map((group) => group.nomination);
  const selectedProposal = selectedRow?.proposalId
    ? proposalsQuery.data?.data.find((proposal) => proposal.id === selectedRow.proposalId)
    : undefined;
  const selectedReferrals = selectedRow
    ? (groups.find((group) => group.nomination.id === selectedRow.id)?.referrals ?? [selectedRow])
    : [];

  const statusWord =
    status === "all"
      ? "total"
      : (X_QUEUE_STATUS_FILTERS.find((filter) => filter.value === status)?.label.toLowerCase() ??
        status);
  const itemWord = rows.length === 1 ? NOUN.singular : NOUN.plural;

  const setStatus = (nextStatus: XNominationFilter) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        status: nextStatus === "all" ? undefined : nextStatus,
      }),
    });
    setSelectedRow(undefined);
  };

  return (
    <section>
      <FilterBar
        title={titleCase(NOUN.singular)}
        subtitle={
          queueQuery.isLoading
            ? `Loading ${NOUN.plural}...`
            : `${rows.length} ${statusWord} ${itemWord}`
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: `Search ${NOUN.plural}`,
          ariaLabel: "Search X Nominations",
        }}
        filters={{
          options: X_QUEUE_STATUS_FILTERS,
          value: status,
          onChange: setStatus,
          ariaLabel: "X Nominations status",
        }}
        exportAction={{
          onClick: () => {
            const count = exportXNominationTable(visibleGroups, status);
            toast.success(`${count} nomination${count === 1 ? "" : "s"} exported`);
          },
          disabled: visibleGroups.length === 0,
        }}
      />

      <RecordsState
        isLoading={queueQuery.isLoading}
        isError={queueQuery.isError}
        isEmpty={rows.length === 0}
        onRetry={() => queueQuery.refetch()}
        loadingFallback={<XNominationTableSkeleton />}
        errorTitle={`${titleCase(NOUN.singular)} could not be loaded`}
        errorBody="Retry the request to continue."
        emptyTitle={`No ${NOUN.plural}`}
        emptyBody="Try another status or search term."
      >
        <XNominationTable rows={rows} selectedId={selectedRow?.id} onSelect={setSelectedRow} />
      </RecordsState>

      <XNominationReviewSheet
        row={selectedRow}
        referrals={selectedReferrals}
        proposal={selectedProposal}
        pending={updateMutation.isPending && updateMutation.variables?.row.id === selectedRow?.id}
        onClose={() => setSelectedRow(undefined)}
        onUpdate={(input) => updateMutation.mutate(input)}
      />
    </section>
  );
}
