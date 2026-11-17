import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireTeamArea } from "@/lib/team-workspace";

export const Route = createFileRoute("/_authenticated/_dashboard")({
  beforeLoad: requireTeamArea,
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="flex flex-col">
      <Outlet />
    </div>
  );
}
