import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/scopes/")({
  loader: () => {
    throw redirect({ to: "/projects", search: { kind: "scope" } });
  },
});
