import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  requireSession,
  type SessionData,
  sessionQueryOptions,
  useApiClient,
  useAuthClient,
} from "@/app";
import { EmailSetupBanner } from "@/components/email-setup-banner";
import { SiteShell } from "@/components/site-shell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: requireSession,
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const apiClient = useApiClient();
  const authClient = useAuthClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions(authClient));
  const user = session?.user;
  const email = user?.email;
  const emailVerified = user?.emailVerified === true;

  useEffect(() => {
    if (!email || !emailVerified) return;
    void apiClient.syncVerifiedNotificationEmail({ email }).catch(() => undefined);
  }, [apiClient, email, emailVerified]);

  return <SiteShell banner={<EmailSetupBanner email={email} emailVerified={emailVerified} />} />;
}
