import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { type SessionData, sessionQueryOptions } from "@/app";

interface AdminContext {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: SessionData["user"] | null;
  session: SessionData["session"] | null;
}

export const Route = createFileRoute("/_public/_admin")({
  beforeLoad: async ({ context, location }) => {
    const { queryClient, authClient } = context;

    const session = await queryClient.ensureQueryData(
      sessionQueryOptions(authClient, context.session),
    );

    if (!session?.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    if (session.user.role !== "admin") {
      throw redirect({ to: "/" });
    }

    const auth: AdminContext = {
      isAuthenticated: true,
      isAdmin: true,
      user: session.user,
      session: session.session,
    };

    return { auth, session };
  },
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
