import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  type DashboardStatus,
  type ProposalTabSearch,
  parseProposalTabSearch,
} from "../-proposal-dashboard";
import { ProposalTab, type ProposalTabActions } from "../-proposal-tab";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard/activity")({
  validateSearch: parseProposalTabSearch,
  head: () => ({ meta: [{ title: "Activity · Admin Dashboard | NEAR Builders" }] }),
  component: ActivityTab,
});

function ActivityTab() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const actions: ProposalTabActions = {
    setQuery: (query) =>
      navigate({
        search: (previous) => ({ ...(previous as ProposalTabSearch), q: query, item: undefined }),
        replace: true,
      }),
    setStatus: (status) =>
      navigate({
        search: (previous) => ({
          ...(previous as ProposalTabSearch),
          status: status as Exclude<DashboardStatus, "all"> | undefined,
          item: undefined,
        }),
      }),
    setSelectedItem: (item) =>
      navigate({
        search: (previous) => ({ ...(previous as ProposalTabSearch), item }),
        replace: item === undefined,
      }),
  };
  return <ProposalTab pluginId="nearcatalog" search={search} actions={actions} />;
}
