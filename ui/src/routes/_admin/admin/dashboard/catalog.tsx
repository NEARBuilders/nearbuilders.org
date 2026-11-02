import { createFileRoute } from "@tanstack/react-router";
import { getProposalQueryOptions, ProposalTab } from "@/components/admin/proposal-tab";
import { parseProposalTabSearch } from "@/lib/admin/proposal-dashboard";
import { dashboardTabTitle, useProposalTabActions } from "@/lib/admin/proposal-tab-route";
import { pageHead } from "@/lib/page-meta";

export const Route = createFileRoute("/_admin/admin/dashboard/catalog")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: pageHead({ title: dashboardTabTitle("NEAR Catalog") }) }),
  loader: async ({ context }) => {
    const { queryClient, apiClient } = context;
    await queryClient.prefetchInfiniteQuery(
      getProposalQueryOptions(apiClient, "nearcatalog-listing", "all", ""),
    );
  },
  component: CatalogTab,
});

function CatalogTab() {
  const search = Route.useSearch();
  const actions = useProposalTabActions();
  return (
    <ProposalTab
      title="NEAR Catalog"
      noun={{ singular: "listing", plural: "listings" }}
      pluginId="nearcatalog-listing"
      search={search}
      actions={actions}
    />
  );
}
