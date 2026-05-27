import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <Outlet />
    </div>
  );
}
