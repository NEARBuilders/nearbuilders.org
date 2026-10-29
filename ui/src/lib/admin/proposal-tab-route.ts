import { useNavigate } from "@tanstack/react-router";
import type { ProposalTabActions } from "@/components/admin/proposal-tab";
import type { DashboardStatus, ProposalTabSearch } from "@/lib/admin/proposal-dashboard";

type SlugStatus = Exclude<DashboardStatus, "all">;

export function useProposalTabActions(): ProposalTabActions {
  const navigate = useNavigate();
  return {
    setQuery: (query) => {
      void navigate({
        search: (previous: ProposalTabSearch) => ({
          ...previous,
          q: query,
          item: undefined,
        }),
        replace: true,
      } as never);
    },
    setStatus: (status) => {
      void navigate({
        search: (previous: ProposalTabSearch) => ({
          ...previous,
          status: status as SlugStatus | undefined,
          item: undefined,
        }),
      } as never);
    },
    setSelectedItem: (item) => {
      void navigate({
        search: (previous: ProposalTabSearch) => ({ ...previous, item }),
        replace: item === undefined,
        resetScroll: false,
      } as never);
    },
  };
}

export function dashboardTabTitle(label: string) {
  return `${label} · Admin Dashboard | NEAR Builders`;
}
