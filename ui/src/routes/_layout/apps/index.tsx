import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowRight, Copy, ExternalLink, Globe } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { BackButton, Badge, Button, CommandCopy } from "@/components";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PAGE_SIZE = 48;
const BASE_RUNTIME = "bos://dev.everything.near/everything.dev";

const getStartCommand = (accountId: string, gatewayId: string) =>
  `bunx everything-dev@latest start --account ${accountId} --domain ${gatewayId}`;

const getExtendsCommand = (accountId: string, gatewayId: string) =>
  `bunx everything-dev@latest init --extends bos://${accountId}/${gatewayId}`;

type SearchParams = {
  preview?: string;
};

export const Route = createFileRoute("/_layout/apps/")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    preview:
      typeof search.preview === "string" && search.preview.length > 0 ? search.preview : undefined,
  }),
  loader: async ({ context }) => {
    const { queryClient, apiClient } = context;
    await Promise.allSettled([
      queryClient.prefetchInfiniteQuery({
        queryKey: ["apps"],
        queryFn: ({ pageParam }) =>
          apiClient.apps.listRegistryApps({
            limit: PAGE_SIZE,
            cursor: pageParam as string | undefined,
          }),
        initialPageParam: undefined,
      }),
      queryClient.prefetchQuery({
        queryKey: ["registry-status"],
        queryFn: () => apiClient.apps.getRegistryStatus(),
        staleTime: 60_000,
      }),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Apps | everything.dev" },
      {
        name: "description",
        content:
          "Browse runtime-composed apps published on NEAR. Each app is a bos.config.json defining how host, UI, and API load together.",
      },
    ],
  }),
  component: AppsIndex,
});

function parseBosAddress(raw: string): { accountId: string; gatewayId?: string } | null {
  const stripped = raw.trim().replace(/^bos:\/\//, "");
  if (!stripped) return null;
  const parts = stripped.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return { accountId: parts[0], gatewayId: parts[1] };
}

function AppsIndex() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const observerRef = useRef<IntersectionObserver | null>(null);

  const [addressInput, setAddressInput] = useState("");

  const {
    data: pages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["apps"],
    queryFn: ({ pageParam }) =>
      apiClient.apps.listRegistryApps({ limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.nextCursor : undefined),
  });

  const statusQuery = useQuery({
    queryKey: ["registry-status"],
    queryFn: () => apiClient.apps.getRegistryStatus(),
    staleTime: 60_000,
  });

  const apps = pages?.pages.flatMap((p) => p.data) ?? [];

  const previewKey =
    search.preview ?? (apps.length > 0 ? `${apps[0].accountId}/${apps[0].gatewayId}` : null);
  const previewApp = apps.find((a) => `${a.accountId}/${a.gatewayId}` === previewKey) ?? null;

  const previewDetailQuery = useQuery({
    queryKey: ["app", previewApp?.accountId, previewApp?.gatewayId],
    queryFn: () =>
      apiClient.apps.getRegistryApp({
        accountId: previewApp!.accountId,
        gatewayId: previewApp!.gatewayId,
      }),
    enabled: Boolean(previewApp),
    staleTime: 30_000,
  });

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasNextPage || isFetchingNextPage) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      });
      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  const handleAddressNavigate = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = parseBosAddress(addressInput);
    if (!parsed) return;
    if (parsed.gatewayId) {
      void navigate({
        to: "/apps/$accountId/$gatewayId",
        params: { accountId: parsed.accountId, gatewayId: parsed.gatewayId },
      });
    } else {
      void navigate({
        to: "/apps/$accountId",
        params: { accountId: parsed.accountId },
      });
    }
  };

  const handleSelect = (accountId: string, gatewayId: string) => {
    void navigate({
      to: "/apps",
      search: (prev) => ({ ...prev, preview: `${accountId}/${gatewayId}` }),
    });
  };

  const handleMobileTap = (accountId: string, gatewayId: string) => {
    void navigate({ to: "/apps/$accountId/$gatewayId", params: { accountId, gatewayId } });
  };

  const canGoBack = router.history.canGoBack?.() ?? false;
  const totalApps = statusQuery.data?.discoveredApps;

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="flex shrink-0 items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Apps</h1>
            {totalApps !== undefined && (
              <Badge variant="secondary" className="font-mono">
                {totalApps}
              </Badge>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            {canGoBack && <BackButton onClick={() => router.history.back()} />}

            <form
              onSubmit={handleAddressNavigate}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-[12px] border-2 border-outset border-border-strong bg-card shadow-sm transition-shadow duration-200 ease-out focus-within:shadow-md">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex h-full shrink-0 items-center border-r-2 border-border-strong bg-muted px-3 text-[11px] font-bold font-mono text-muted-foreground select-none">
                      bos://
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">
                      Navigate to a published runtime by its canonical bos:// address. Format:{" "}
                      <code>account/gateway</code>
                    </p>
                  </TooltipContent>
                </Tooltip>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="dev.everything.near/everything.dev"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
                  aria-label="bos:// address"
                />
              </div>

              <Button
                type="submit"
                variant="outline"
                size="icon-sm"
                disabled={!addressInput.trim()}
                aria-label="Navigate"
                className="shrink-0 rounded-[10px] border-2 border-outset border-border-strong shadow-sm hover:shadow-md"
              >
                <ArrowRight size={14} />
              </Button>
            </form>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex flex-col overflow-hidden border-r border-border w-full lg:w-[360px] lg:shrink-0">
            <AppList
              apps={apps}
              isLoading={isLoading}
              selectedKey={previewApp ? `${previewApp.accountId}/${previewApp.gatewayId}` : null}
              onSelect={handleSelect}
              onMobileTap={handleMobileTap}
              sentinelRef={sentinelRef}
              isFetchingNextPage={isFetchingNextPage}
            />
          </div>

          <div className="hidden lg:flex flex-1 flex-col overflow-y-auto bg-muted">
            {previewApp ? (
              <AppPreview
                app={previewApp}
                detail={previewDetailQuery.data?.data ?? null}
                isLoadingDetail={previewDetailQuery.isLoading}
              />
            ) : (
              <div className="flex flex-1 h-full items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2 py-16">
                  <Globe size={28} className="mx-auto text-border" />
                  <p className="text-sm">Select an app to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

type AppSummary = {
  accountId: string;
  gatewayId: string;
  status: "ready" | "invalid";
  extends: string | null;
  domain: string | null;
  openUrl: string | null;
  hostUrl: string | null;
  uiUrl: string | null;
  uiSsrUrl: string | null;
  apiUrl: string | null;
  canonicalKey: string;
  canonicalConfigUrl: string;
  startCommand: string;
  metadata: {
    title: string | null;
    description: string | null;
    claimedBy: string | null;
    repoUrl: string | null;
    homepageUrl: string | null;
    imageUrl: string | null;
    updatedAt: string | null;
  } | null;
};

type AppDetail = AppSummary & {
  metadataKey: string;
  metadataContractId: string;
  metadataFastKvUrl: string;
  resolvedConfig: Record<string, unknown>;
};

function AppList({
  apps,
  isLoading,
  selectedKey,
  onSelect,
  onMobileTap,
  sentinelRef,
  isFetchingNextPage,
}: {
  apps: AppSummary[];
  isLoading: boolean;
  selectedKey: string | null;
  onSelect: (accountId: string, gatewayId: string) => void;
  onMobileTap: (accountId: string, gatewayId: string) => void;
  sentinelRef: (node: HTMLDivElement | null) => void;
  isFetchingNextPage: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-[12px]" />
        ))}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <Globe size={22} className="text-border" />
        <p className="text-sm text-muted-foreground">No published apps found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {apps.map((app) => {
        const key = `${app.accountId}/${app.gatewayId}`;
        const isSelected = selectedKey === key;
        const isTenant = app.extends === BASE_RUNTIME;
        const title = app.metadata?.title;

        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                onSelect(app.accountId, app.gatewayId);
              } else {
                onMobileTap(app.accountId, app.gatewayId);
              }
            }}
            className={`w-full text-left border-b border-border transition-colors duration-[120ms] group px-3.5 py-2.5 border-l-[3px] ${
              isSelected
                ? "bg-brand-accent-light border-l-brand-accent"
                : "border-l-transparent hover:bg-muted/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                      app.status === "ready" ? "bg-brand-accent" : "bg-destructive"
                    }`}
                    title={app.status}
                  />
                  {isTenant && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      tenant
                    </Badge>
                  )}
                  {app.domain && (
                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4">
                      {app.domain}
                    </Badge>
                  )}
                </div>
                <div className="font-mono text-foreground truncate text-xs font-semibold">
                  {title ?? `${app.accountId} / ${app.gatewayId}`}
                </div>
                {title && (
                  <div className="font-mono text-muted-foreground truncate text-[11px]">
                    {app.accountId} / {app.gatewayId}
                  </div>
                )}
              </div>
              <ExternalLink
                size={11}
                className="text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity lg:hidden"
              />
            </div>
          </button>
        );
      })}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && (
        <div className="py-3 text-center text-xs text-muted-foreground">Loading more...</div>
      )}
    </div>
  );
}

function AppPreview({
  app,
  detail,
  isLoadingDetail,
}: {
  app: AppSummary;
  detail: AppDetail | null;
  isLoadingDetail: boolean;
}) {
  const isTenant = app.extends === BASE_RUNTIME;
  const bosUri = `bos://${app.accountId}/${app.gatewayId}`;
  const title = app.metadata?.title ?? `${app.accountId} / ${app.gatewayId}`;
  const startCommand = getStartCommand(app.accountId, app.gatewayId);
  const extendsCommand = getExtendsCommand(app.accountId, app.gatewayId);

  const handleCopyBosUri = async () => {
    await navigator.clipboard.writeText(bosUri);
    toast.success("Copied bos:// address");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b border-border bg-card px-5 py-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                app.status === "ready" ? "bg-brand-accent" : "bg-destructive"
              }`}
              title={app.status}
            />
            {isTenant && (
              <Badge variant="outline" className="text-xs">
                tenant
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {app.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {app.openUrl && (
              <Button asChild size="sm" className="h-7 px-2.5 text-xs gap-1">
                <a href={app.openUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={10} />
                  open
                </a>
              </Button>
            )}
            <Button asChild variant="secondary" size="sm" className="h-7 px-2.5 text-xs">
              <Link
                to="/apps/$accountId/$gatewayId"
                params={{ accountId: app.accountId, gatewayId: app.gatewayId }}
              >
                inspect
              </Link>
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyBosUri}
            className="font-mono"
          >
            <span className="text-[11px]">{bosUri}</span>
            <Copy size={10} className="shrink-0 opacity-60" />
          </Button>
        </div>

        {app.metadata?.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {app.metadata.description}
          </p>
        )}

        {isTenant && (
          <div className="rounded-[8px] border border-border bg-muted/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Tenant runtime</span> — extends{" "}
              <code className="font-mono">bos://dev.everything.near/everything.dev</code>. Served
              via the shared host with a custom UI.
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {isLoadingDetail ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
            <section className="space-y-1.5">
              <SectionLabel>Runtime</SectionLabel>
              <RuntimeRow label="host" value={app.hostUrl} />
              <RuntimeRow label="ui" value={app.uiUrl} />
              <RuntimeRow label="api" value={app.apiUrl} />
              {app.uiSsrUrl && <RuntimeRow label="ssr" value={app.uiSsrUrl} />}
              {app.extends && <RuntimeRow label="extends" value={app.extends} isUrl={false} mono />}
            </section>

            {detail?.metadata && (
              <section className="space-y-1.5">
                <SectionLabel>Metadata</SectionLabel>
                {detail.metadata.claimedBy && (
                  <RuntimeRow label="claimed by" value={detail.metadata.claimedBy} isUrl={false} />
                )}
                {detail.metadata.repoUrl && (
                  <RuntimeRow label="repo" value={detail.metadata.repoUrl} />
                )}
                {detail.metadata.updatedAt && (
                  <RuntimeRow
                    label="updated"
                    value={new Date(detail.metadata.updatedAt).toLocaleDateString()}
                    isUrl={false}
                  />
                )}
              </section>
            )}

            <section className="space-y-1.5">
              <SectionLabel>Start command</SectionLabel>
              <CommandCopy command={startCommand} />
            </section>

            <section className="space-y-1.5">
              <SectionLabel>Extends command</SectionLabel>
              <CommandCopy command={extendsCommand} />
            </section>

            <div className="flex gap-3">
              {detail?.canonicalConfigUrl && (
                <a
                  href={detail.canonicalConfigUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150 underline"
                >
                  FastKV config
                </a>
              )}
              <Link
                to="/apps/$accountId"
                params={{ accountId: app.accountId }}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150 underline"
              >
                all from {app.accountId}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function RuntimeRow({
  label,
  value,
  isUrl = true,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  isUrl?: boolean;
  mono?: boolean;
}) {
  if (!value) return null;
  const looksLikeUrl = isUrl && /^https?:\/\//.test(value);

  return (
    <div className="flex items-start gap-2 rounded-[8px] border border-border bg-muted/10 px-2.5 py-1.5 text-[11px]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 pt-px min-w-[52px]">
        {label}
      </span>
      {looksLikeUrl ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-foreground hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <span className={`text-foreground break-all ${mono ? "font-mono" : ""}`}>{value}</span>
      )}
    </div>
  );
}
