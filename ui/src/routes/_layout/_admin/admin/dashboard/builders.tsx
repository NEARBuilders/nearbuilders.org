import { createFileRoute } from "@tanstack/react-router";
import { parseProposalTabSearch } from "../-proposal-dashboard";
import { getProposalQueryOptions, ProposalTab } from "../-proposal-tab";
import { dashboardTabTitle, useProposalTabActions } from "../-proposal-tab-route";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard/builders")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: [{ title: dashboardTabTitle("Builders") }] }),
  loader: async ({ context }) => {
    const { queryClient, apiClient } = context;
    await queryClient.prefetchInfiniteQuery(
      getProposalQueryOptions(apiClient, "builders", "all", ""),
    );
  },
  component: BuildersTab,
});

function BuildersTab() {
  const search = Route.useSearch();
  const actions = useProposalTabActions();
  return (
    <ProposalTab
      title="Builders"
      noun={{ singular: "builder", plural: "builders" }}
      pluginId="builders"
      search={search}
      actions={actions}
    />
  );
}
