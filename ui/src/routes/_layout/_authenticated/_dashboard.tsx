import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const isDocumentRoute = useRouterState({
    select: (s) =>
      s.location.pathname === "/home" ||
      s.location.pathname.startsWith("/settings") ||
      s.location.pathname.startsWith("/organizations"),
  });

  return (
    <div className={isDocumentRoute ? "flex flex-col" : "h-dvh flex flex-col overflow-hidden"}>
      <Outlet />
    </div>
  );
}
