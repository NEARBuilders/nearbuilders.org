import { createFileRoute } from "@tanstack/react-router";
import { getProposalQueryOptions, ProposalTab } from "@/components/admin/proposal-tab";
import { parseProposalTabSearch } from "@/lib/admin/proposal-dashboard";
import { dashboardTabTitle, useProposalTabActions } from "@/lib/admin/proposal-tab-route";
import { pageHead } from "@/lib/page-meta";

export const Route = createFileRoute("/_admin/admin/dashboard/projects")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: pageHead({ title: dashboardTabTitle("Projects") }) }),
  loader: async ({ context }) => {
    const { queryClient, apiClient } = context;
    await queryClient.prefetchInfiniteQuery(
      getProposalQueryOptions(apiClient, "projects", "all", ""),
    );
  },
  component: ProjectsTab,
});

function ProjectsTab() {
  const search = Route.useSearch();
  const actions = useProposalTabActions();
  return (
    <ProposalTab
      title="Projects"
      noun={{ singular: "project", plural: "projects" }}
      pluginId="projects"
      search={search}
      actions={actions}
    />
  );
}
