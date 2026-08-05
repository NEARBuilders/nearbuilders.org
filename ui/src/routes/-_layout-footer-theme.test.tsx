import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
}));

vi.mock("@tanstack/react-router", () => ({
  ClientOnly: ({ children }: { children: React.ReactNode }) => children,
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  Outlet: () => null,
  useRouterState: () => false,
}));

vi.mock("@/app", () => ({
  sessionQueryOptions: () => ({}),
  useAuthClient: () => ({}),
}));

vi.mock("@/assets/built_on.png", () => ({ default: "/built-on.png" }));
vi.mock("@/assets/built_on_rev.png", () => ({ default: "/built-on-reversed.png" }));
vi.mock("@/components/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/components/user-nav", () => ({ UserNav: () => null }));

import { Route } from "./_layout";

describe("site footer theme", () => {
  it("uses theme-native colors instead of inverted page colors", () => {
    const Layout = Route.options.component;
    if (!Layout) throw new Error("Layout route component is missing");

    const html = renderToStaticMarkup(<Layout />);
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)?.[0];

    expect(footer).toBeDefined();
    expect(footer).toContain("bg-background");
    expect(footer).toContain("text-foreground");
    expect(footer).toContain("border-border");
    expect(footer).not.toContain("bg-foreground");
    expect(footer).not.toContain("text-background");
    expect(footer).not.toContain("border-background");
    expect(footer).toMatch(/built-on\.png[^>]+dark:hidden/);
    expect(footer).toMatch(/built-on-reversed\.png[^>]+dark:block/);
  });
});
