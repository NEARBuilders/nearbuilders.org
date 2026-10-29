import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-meta";
import { getProposalQueryOptions, ProposalTab } from "@/components/admin/proposal-tab";
import { parseProposalTabSearch } from "@/lib/admin/proposal-dashboard";
import { dashboardTabTitle, useProposalTabActions } from "@/lib/admin/proposal-tab-route";

export const Route = createFileRoute("/_admin/admin/dashboard/events")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: pageHead({ title: dashboardTabTitle("Events") }) }),
  loader: async ({ context }) => {
    const { queryClient, apiClient } = context;
    await queryClient.prefetchInfiniteQuery(
      getProposalQueryOptions(apiClient, "events", "all", ""),
    );
  },
  component: EventsTab,
});

function EventsTab() {
  const search = Route.useSearch();
  const actions = useProposalTabActions();
  return (
    <ProposalTab
      title="Events"
      noun={{ singular: "event", plural: "events" }}
      pluginId="events"
      search={search}
      actions={actions}
    />
  );
}
