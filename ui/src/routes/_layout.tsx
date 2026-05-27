import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { sessionQueryOptions } from "@/app";
import builtOn from "@/assets/built_on.png";
import builtOnRev from "@/assets/built_on_rev.png";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/user-nav";

export const Route = createFileRoute("/_layout")({
  beforeLoad: async ({ context }) => {
    const { queryClient, authClient } = context;
    const session = await queryClient.ensureQueryData(
      sessionQueryOptions(authClient, context.session),
    );
    return {
      assetsUrl: context.assetsUrl || "",
      runtimeConfig: context.runtimeConfig,
      session,
    };
  },
  component: Layout,
});

const navLinks = [
  { label: "Builders", to: "/builders" },
  { label: "Projects", to: "/projects" },
] as const;

function Layout() {
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });
  const appName = "Near Builders";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden">
          <div className="h-full bg-brand-green animate-progress-bar" />
        </div>
      )}

      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 font-black text-lg tracking-tight text-foreground hover:opacity-80 transition-opacity"
            >
              <img src="/logo.png" alt={appName} className="h-8 w-auto" />
              {appName}
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors pb-[2px] border-b-2 border-transparent [&.active]:text-foreground [&.active]:font-semibold [&.active]:border-brand-cyan"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              <UserNav />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="md:hidden size-9 rounded-md"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background animate-fade-in">
            <nav className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors [&.active]:text-foreground [&.active]:bg-accent"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <ThemeToggle />
                <UserNav />
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 animate-fade-in-up">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-8 sm:gap-12">
              <div className="flex flex-col gap-4">
                <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
                  <img src="/logo.png" alt={appName} className="h-12 w-auto" />
                </Link>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Open platform for builders on NEAR
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
                  Ecosystem
                </h3>
                <nav className="flex flex-col gap-2">
                  <a
                    href="https://ironclaw.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Ironclaw
                  </a>
                  <a
                    href="https://near.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    NEAR AI
                  </a>
                  <a
                    href="https://near.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    NEAR Protocol
                  </a>
                  <a
                    href="https://near.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    NEAR Dev
                  </a>
                  <a
                    href="https://nearcatalog.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    NEAR Catalog
                  </a>
                  <a
                    href="https://nearlegion.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    NEAR Legion
                  </a>
                </nav>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
                  Docs
                </h3>
                <nav className="flex flex-col gap-2">
                  <a
                    href="https://docs.ironclaw.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    IronClaw Docs
                  </a>
                  <a
                    href="https://docs.near.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    NEAR AI Docs
                  </a>
                  <a
                    href="https://docs.near.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    NEAR Docs
                  </a>
                  <a
                    href="https://docs.near-intents.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    NEAR Intents Docs
                  </a>
                  <a
                    href="https://docs.near.org/getting-started/hackathons"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Builder Starter Guide
                  </a>
                </nav>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <p className="text-xs text-muted-foreground">
                  &copy; {new Date().getFullYear()} {appName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/nearbuilders"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="GitHub"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.26-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.28-.5-4.72-.5-7 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.5-.8 1.48-1 3.5.28.28 2 1 3.5 1s3.22-.72 3.5-1" />
                    <path d="M9 18c-4.51 2-5-2-7-2" />
                  </svg>
                </a>
                <a
                  href="https://x.com/NearBuilders"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="X (Twitter)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://t.me/nearbuilderschat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Telegram"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m22 2-7 20-4-9-9-4z" />
                    <path d="m22 2-11 11" />
                  </svg>
                </a>
                <a
                  href="https://near.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative h-5 w-[84px] shrink-0 ml-2"
                >
                  <img
                    src={builtOn}
                    alt="Built on NEAR"
                    className="absolute inset-0 h-full w-full object-contain dark:hidden"
                  />
                  <img
                    src={builtOnRev}
                    alt="Built on NEAR"
                    className="absolute inset-0 hidden h-full w-full object-contain dark:block"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
