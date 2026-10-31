import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/organizations/")({
  loader: async () => {
    throw redirect({ to: "/settings/workspace" });
  },
});
