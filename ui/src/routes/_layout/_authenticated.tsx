import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { type SessionData, sessionQueryOptions, useApiClient } from "@/app";
import { EmailSetupBanner } from "@/components/email-setup-banner";

interface AuthContext {
  isAuthenticated: boolean;
  user: SessionData["user"] | null;
  session: SessionData["session"] | null;
  activeOrganizationId: string | null;
  isAnonymous: boolean;
  isAdmin: boolean;
  isBanned: boolean;
}

export const Route = createFileRoute("/_layout/_authenticated")({
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

    if (session.user.banned) {
      throw redirect({
        to: "/login",
        hash: "banned",
      });
    }

    const auth: AuthContext = {
      isAuthenticated: true,
      user: session.user,
      session: session.session,
      activeOrganizationId: session.session?.activeOrganizationId || null,
      isAnonymous: session.user.isAnonymous || false,
      isAdmin: session.user.role === "admin",
      isBanned: session.user.banned || false,
    };
    return {
      auth,
      session,
    };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { auth } = Route.useRouteContext();
  const apiClient = useApiClient();
  const user = auth.user as { email?: string | null; emailVerified?: boolean | null } | null;
  const email = user?.email;
  const emailVerified = user?.emailVerified === true;

  useEffect(() => {
    if (!email || !emailVerified) return;
    void apiClient.syncVerifiedNotificationEmail({ email }).catch(() => undefined);
  }, [apiClient, email, emailVerified]);

  return (
    <>
      <EmailSetupBanner email={email} emailVerified={emailVerified} />
      <Outlet />
    </>
  );
}
