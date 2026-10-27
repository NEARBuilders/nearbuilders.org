import { createFileRoute } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/app";
import { SiteShell } from "@/components/site-shell";

export const Route = createFileRoute("/_public")({
  beforeLoad: async ({ context }) => {
    const { queryClient, authClient } = context;
    const session = await queryClient.ensureQueryData(sessionQueryOptions(authClient));
    return {
      runtimeConfig: context.runtimeConfig,
      session,
    };
  },
  component: SiteShell,
});
