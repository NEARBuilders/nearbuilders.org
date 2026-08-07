import { useQuery } from "@tanstack/react-query";
import { ClientOnly, createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { GitFork, Menu, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { sessionQueryOptions, useAuthClient } from "@/app";
import builtOn from "@/assets/built_on.png";
import builtOnRev from "@/assets/built_on_rev.png";
import { NotificationBell } from "@/components/notification-bell";
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
      runtimeConfig: context.runtimeConfig,
      session,
    };
  },
  component: Layout,
});

const navLinks = [
  { label: "Builders", to: "/builders" },
  { label: "Projects", to: "/projects" },
  { label: "Events", to: "/events" },
  { label: "Activity", to: "/activity" },
] as const;

const ecosystemLinks = [
  { href: "https://ironclaw.com", label: "Ironclaw" },
  { href: "https://near.ai", label: "NEAR AI" },
  { href: "https://near.org", label: "NEAR Protocol" },
  { href: "https://near.dev", label: "NEAR Dev" },
  { href: "https://nearcatalog.xyz", label: "NEAR Catalog" },
  { href: "https://nearlegion.com", label: "NEAR Legion" },
] as const;

const resourceLinks = [
  { href: "https://docs.near.org", label: "NEAR Docs" },
  { href: "https://docs.near.ai", label: "NEAR AI Docs" },
  { href: "https://docs.near-intents.org/", label: "NEAR Intents" },
  { href: "https://docs.ironclaw.com/", label: "IronClaw Docs" },
  { href: "https://docs.near.org/getting-started/hackathons", label: "Builder Starter Guide" },
] as const;

function Layout() {
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });
  const appName = "Near Builders";
  const [mobileOpen, setMobileOpen] = useState(false);
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const user = session?.user;

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh flex flex-col overflow-x-clip bg-background text-foreground">
      <ClientOnly>
        {isNavigating && (
          <div className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden">
            <div className="h-full bg-brand-green animate-progress-bar" />
          </div>
        )}
      </ClientOnly>

      <header className="sticky top-0 z-40 w-full border-b border-border bg-background text-foreground backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-lg font-black tracking-tight text-foreground transition-opacity hover:opacity-75"
            >
              <img src="/logo.png" alt={appName} className="h-9 w-auto" />
              {appName}
            </Link>

            <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-border bg-card p-1 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-full px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-foreground [&.active]:text-background"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-1 rounded-full border border-border bg-card p-1 md:flex">
              <ThemeToggle />
              {user && <NotificationBell />}
              <UserNav />
            </div>

            <div className="flex items-center gap-1 md:hidden">
              {user && <NotificationBell />}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-10 rounded-full border border-border bg-card text-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden">
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-background text-foreground animate-fade-in-up"
          >
            <div className="mx-auto flex min-h-full max-w-7xl flex-col px-4 py-8 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
                Explore the network
              </p>
              <nav className="mt-5 border-y border-border">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className="block border-b border-border py-5 text-3xl font-black tracking-tight text-foreground transition-colors last:border-b-0 hover:text-brand-accent [&.active]:text-brand-accent"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto pt-8">
                <Link
                  to="/builders/add"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center rounded-full bg-brand-accent px-5 py-3.5 text-sm font-bold text-brand-mint-foreground"
                >
                  Join the builder network
                </Link>
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-foreground">
                  <ThemeToggle />
                  <UserNav />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 animate-fade-in-up">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-20">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-3 text-lg font-black tracking-tight text-foreground transition-opacity hover:opacity-75"
              >
                <img src="/logo.png" alt={appName} className="h-12 w-auto" />
                {appName}
              </Link>
              <h2 className="mt-8 max-w-xl text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
                The open network for people building what's next.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                Find collaborators, make your work visible, and keep shipping with the NEAR
                ecosystem behind you.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand-accent">
                  Explore
                </h3>
                <nav className="mt-5 flex flex-col gap-3">
                  {navLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand-accent">
                  Ecosystem
                </h3>
                <nav className="mt-5 flex flex-col gap-3">
                  {ecosystemLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand-accent">
                  Resources
                </h3>
                <nav className="mt-5 flex flex-col gap-3">
                  {resourceLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-6 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} {appName}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/nearbuilders"
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="GitHub"
              >
                <GitFork className="size-4" />
              </a>
              <a
                href="https://x.com/NearBuilders"
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="X (Twitter)"
              >
                <span className="text-xs font-black">X</span>
              </a>
              <a
                href="https://t.me/nearbuilderschat"
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Telegram"
              >
                <Send className="size-4" />
              </a>
              <a
                href="https://near.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="relative ml-2 h-5 w-[84px] shrink-0"
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
      </footer>
    </div>
  );
}
