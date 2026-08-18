import { createFileRoute } from "@tanstack/react-router";
import { parseProposalTabSearch } from "../-proposal-dashboard";
import { getProposalQueryOptions, ProposalTab } from "../-proposal-tab";
import { dashboardTabTitle, useProposalTabActions } from "../-proposal-tab-route";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard/projects")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: [{ title: dashboardTabTitle("Projects") }] }),
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
