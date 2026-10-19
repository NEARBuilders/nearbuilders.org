import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { BUILD_PAGE_PATH } from "@/lib/site-paths";

export const Route = createFileRoute("/_layout/ironclaw")({
  beforeLoad: () => {
    throw redirect({ to: BUILD_PAGE_PATH, replace: true });
  },
  component: IronclawRedirect,
});

function IronclawRedirect() {
  return <Navigate to={BUILD_PAGE_PATH} replace />;
}
