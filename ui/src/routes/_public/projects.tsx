import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  return (
    <div className="flex flex-col">
      <Outlet />
    </div>
  );
}
