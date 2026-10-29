import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireSession } from "@/app";
import { SiteShell } from "@/components/site-shell";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async (args) => {
    const result = await requireSession(args);
    if (result.session.user?.role !== "admin") {
      throw redirect({ to: "/dashboard", search: { restricted: "admin" } });
    }
    return result;
  },
  component: SiteShell,
});
