import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Download, Search, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedFilter } from "@/components/ui/segmented-filter";
import { exportXNominationTable } from "@/lib/export-csv";
import {
  filterXNominationGroups,
  groupXNominationRecords,
  X_QUEUE_STATUS_FILTERS,
  type XNominationFilter,
  type XNominationRecord,
  type XNominationUpdate,
} from "@/lib/x-nomination-queue";
import { XNominationReviewSheet } from "./-x-nomination-review-sheet";
import { XNominationTable, XNominationTableSkeleton } from "./-x-nomination-table";

export function XNominationQueue() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<XNominationFilter>("pending_contact");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<XNominationRecord>();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const queueQuery = useInfiniteQuery({
    queryKey: ["admin-x-nominations"],
    queryFn: ({ pageParam }) =>
      apiClient.builders.listXNominationQueue({ limit: 100, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    staleTime: 15_000,
  });
  const proposalsQuery = useQuery({
    queryKey: ["admin-x-nomination-proposals"],
    queryFn: () => apiClient.getProposals({ pluginId: "builders", limit: 100 }),
    staleTime: 30_000,
  });
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
      await queryClient.invalidateQueries({ queryKey: ["admin-x-nominations"] });
    },
    onError: async (error: Error) => {
      toast.error(error.message || "The X nomination could not be updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-x-nominations"] });
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
    () => filterXNominationGroups(groups, status, search),
    [groups, search, status],
  );
  const rows = visibleGroups.map((group) => group.nomination);
  const selectedProposal = selectedRow?.proposalId
    ? proposalsQuery.data?.data.find((proposal) => proposal.id === selectedRow.proposalId)
    : undefined;
  const selectedReferrals = selectedRow
    ? (groups.find((group) => group.nomination.id === selectedRow.id)?.referrals ?? [selectedRow])
    : [];

  return (
    <section aria-labelledby="x-nominations-heading">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="x-nominations-heading" className="text-xl font-bold text-foreground">
            Nominations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {queueQuery.isLoading
              ? "Loading nominations..."
              : `${rows.length} ${status === "all" ? "total" : X_QUEUE_STATUS_FILTERS.find((filter) => filter.value === status)?.label.toLowerCase()} nomination${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search nominations"
              aria-label="Search X nominations"
              className="h-10 pl-8 sm:h-8"
            />
          </div>
          <div className="max-w-full overflow-x-auto pb-1 [&_button]:h-9 sm:pb-0 sm:[&_button]:h-7">
            <SegmentedFilter
              options={[...X_QUEUE_STATUS_FILTERS]}
              value={status}
              onChange={(nextStatus) => {
                setStatus(nextStatus);
                setSelectedRow(undefined);
              }}
              ariaLabel="X nomination status"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 sm:h-8"
            disabled={visibleGroups.length === 0}
            onClick={() => {
              const count = exportXNominationTable(visibleGroups, status);
              toast.success(`${count} nomination${count === 1 ? "" : "s"} exported`);
            }}
          >
            <Download />
            Export CSV
          </Button>
        </div>
      </div>

      {queueQuery.isLoading ? (
        <XNominationTableSkeleton />
      ) : queueQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center">
          <CircleAlert className="mx-auto size-6 text-destructive" />
          <p className="mt-3 text-sm text-muted-foreground">
            The X nomination queue could not be loaded.
          </p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => queueQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
          <Send className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 font-semibold text-foreground">No nominations in this view</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another status or search term.</p>
        </div>
      ) : (
        <XNominationTable rows={rows} selectedId={selectedRow?.id} onSelect={setSelectedRow} />
      )}

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
