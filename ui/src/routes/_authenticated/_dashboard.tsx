import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="flex flex-col">
      <Outlet />
    </div>
  );
}
