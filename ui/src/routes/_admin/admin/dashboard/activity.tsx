import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-meta";
import { getProposalQueryOptions, ProposalTab } from "@/components/admin/proposal-tab";
import { parseProposalTabSearch } from "@/lib/admin/proposal-dashboard";
import { dashboardTabTitle, useProposalTabActions } from "@/lib/admin/proposal-tab-route";

export const Route = createFileRoute("/_admin/admin/dashboard/activity")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: pageHead({ title: dashboardTabTitle("Activity") }) }),
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
