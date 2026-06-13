import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/projects/new")({
  component: () => <Outlet />,
});
