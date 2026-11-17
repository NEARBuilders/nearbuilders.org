import { createFileRoute, redirect } from "@tanstack/react-router";
import { isProjectKind } from "@/lib/project-search";

export const Route = createFileRoute("/_public/projects/$kind/")({
  validateSearch: (search) => search as Record<string, unknown>,
  loader: async ({ params }) => {
    const { kind } = params;
    throw redirect({
      to: "/projects",
      search: isProjectKind(kind) ? { kind } : {},
    });
  },
});
