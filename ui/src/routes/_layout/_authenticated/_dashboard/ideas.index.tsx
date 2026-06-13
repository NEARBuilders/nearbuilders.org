import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/ideas/")({
  loader: () => {
    throw redirect({ to: "/projects", search: { kind: "idea" } });
  },
});
