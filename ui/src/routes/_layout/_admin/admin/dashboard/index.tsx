import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_admin/admin/dashboard/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/dashboard/builders" });
  },
});
