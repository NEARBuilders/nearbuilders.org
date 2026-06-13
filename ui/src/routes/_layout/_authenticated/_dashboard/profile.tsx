import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/profile")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
  component: ProfileRedirect,
});

function ProfileRedirect() {
  return <Navigate to="/dashboard" replace />;
}
