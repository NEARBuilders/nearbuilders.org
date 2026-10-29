import { createFileRoute } from "@tanstack/react-router";
import { getProposalQueryOptions, ProposalTab } from "@/components/admin/proposal-tab";
import { parseProposalTabSearch } from "@/lib/admin/proposal-dashboard";
import { dashboardTabTitle, useProposalTabActions } from "@/lib/admin/proposal-tab-route";
import { pageHead } from "@/lib/page-meta";

export const Route = createFileRoute("/_admin/admin/dashboard/builders")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: pageHead({ title: dashboardTabTitle("Builders") }) }),
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
