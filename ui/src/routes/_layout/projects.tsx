import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <Outlet />
    </div>
  );
}
