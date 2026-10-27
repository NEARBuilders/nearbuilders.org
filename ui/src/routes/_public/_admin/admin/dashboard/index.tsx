import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/_admin/admin/dashboard/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/dashboard/builders" });
  },
});
