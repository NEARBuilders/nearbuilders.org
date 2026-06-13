import { createFileRoute, redirect } from "@tanstack/react-router";
import { isProjectKind } from "./-search";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/projects/$kind/")({
  validateSearch: (search) => search as Record<string, unknown>,
  loader: async ({ params }) => {
    const { kind } = params;
    throw redirect({
      to: "/projects",
      search: isProjectKind(kind) ? { kind } : {},
    });
  },
});
