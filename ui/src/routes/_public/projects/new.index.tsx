import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/projects/new/")({
  loader: () => {
    throw redirect({
      to: "/projects/new/$kind",
      params: { kind: "idea" },
      search: { tab: "write" },
    });
  },
});
