import { createFileRoute } from "@tanstack/react-router";
import { parseProposalTabSearch } from "../-proposal-dashboard";
import { getProposalQueryOptions, ProposalTab } from "../-proposal-tab";
import { dashboardTabTitle, useProposalTabActions } from "../-proposal-tab-route";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard/events")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: [{ title: dashboardTabTitle("Events") }] }),
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
