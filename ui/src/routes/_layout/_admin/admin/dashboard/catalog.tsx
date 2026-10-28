import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-meta";
import { CatalogSends } from "../-catalog-sends";
import { parseProposalTabSearch } from "../-proposal-dashboard";
import { getProposalQueryOptions, ProposalTab } from "../-proposal-tab";
import { dashboardTabTitle, useProposalTabActions } from "../-proposal-tab-route";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard/catalog")({
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
    <div className="space-y-6">
      <CatalogSends />
      <ProposalTab
        title="NEAR Catalog"
        noun={{ singular: "listing", plural: "listings" }}
        pluginId="nearcatalog-listing"
        search={search}
        actions={actions}
      />
    </div>
  );
}
