import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/app";
import { Tabs, TabsList, TabsTrigger } from "@/components";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Settings | auth.everything.dev" },
      { name: "description", content: "Manage your account identity and security." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
  },
  component: SettingsLayout,
});

const tabs = [
  { value: "profile", to: "/settings/profile", label: "Account" },
  { value: "auth-methods", to: "/settings/auth-methods", label: "Auth Methods" },
  { value: "api-keys", to: "/settings/api-keys", label: "API Keys" },
  { value: "security", to: "/settings/security", label: "Security" },
] as const;

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const activeTab =
    tabs.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))?.value ?? "profile";

  return (
    <div className="w-full px-4 py-6 pb-10 sm:px-6 sm:py-8 sm:pb-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage your account details, sign-in methods, API keys, and security.
          </p>
        </div>

        <Tabs value={activeTab} className="w-full min-w-0">
          <div className="overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max min-w-full justify-start overflow-visible">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} asChild className="shrink-0">
                  <Link to={tab.to}>{tab.label}</Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div key={activeTab} className="motion-safe:animate-settings-panel-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
