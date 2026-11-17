import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/results/")({
  loader: () => {
    throw redirect({ to: "/projects", search: { kind: "result" } });
  },
});
