import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/_authenticated/_dashboard/settings/")({
  loader: async () => {
    throw redirect({ to: "/settings/profile" });
  },
});
