import { createFileRoute } from "@tanstack/react-router";
import { parseProposalTabSearch } from "../-proposal-dashboard";
import { getProposalQueryOptions, ProposalTab } from "../-proposal-tab";
import { dashboardTabTitle, useProposalTabActions } from "../-proposal-tab-route";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard/activity")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: [{ title: dashboardTabTitle("Activity") }] }),
  loader: async ({ context }) => {
    const { queryClient, apiClient } = context;
    await queryClient.prefetchInfiniteQuery(
      getProposalQueryOptions(apiClient, "nearcatalog", "all", ""),
    );
  },
  component: ActivityTab,
});

function ActivityTab() {
  const search = Route.useSearch();
  const actions = useProposalTabActions();
  return (
    <ProposalTab
      title="Activity"
      noun={{ singular: "contribution", plural: "contributions" }}
      pluginId="nearcatalog"
      search={search}
      actions={actions}
    />
  );
}
