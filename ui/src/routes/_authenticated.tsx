import { createFileRoute } from "@tanstack/react-router";
import { requireSession } from "@/app";
import { SiteShell } from "@/components/site-shell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: requireSession,
  component: SiteShell,
});
