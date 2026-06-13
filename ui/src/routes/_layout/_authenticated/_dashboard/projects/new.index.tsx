import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/projects/new/")({
  loader: () => {
    throw redirect({
      to: "/projects/new/$kind",
      params: { kind: "idea" },
      search: { tab: "write" },
    });
  },
});
