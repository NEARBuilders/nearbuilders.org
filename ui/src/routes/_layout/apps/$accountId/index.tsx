import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { BackButton, BackLink, Badge, Button } from "@/components";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";

const BASE_RUNTIME = "bos://dev.everything.near/everything.dev";

export const Route = createFileRoute("/_layout/apps/$accountId/")({
  loader: async ({ params, context }) => {
    const { queryClient, apiClient } = context;
    await queryClient.prefetchQuery({
      queryKey: ["apps-account", params.accountId],
      queryFn: () => apiClient.apps.getRegistryAppsByAccount({ accountId: params.accountId }),
      staleTime: 30_000,
    });
    return { accountId: params.accountId };
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.accountId} | Apps | everything.dev` },
      {
        name: "description",
        content: `Browse published runtime configurations for ${params.accountId} on NEAR.`,
      },
    ],
  }),
  component: AccountAppsPage,
});

function AccountAppsPage() {
  const { accountId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const apiClient = useApiClient();
  const canGoBack = router.history.canGoBack?.() ?? false;

  const accountQuery = useSuspenseQuery({
    queryKey: ["apps-account", accountId],
    queryFn: () => apiClient.apps.getRegistryAppsByAccount({ accountId }),
    staleTime: 30_000,
  });

  const apps = accountQuery.data?.data ?? [];
  const readyCount = apps.filter((a) => a.status === "ready").length;
  const bosUri = `bos://${accountId}`;

  return (
    <TooltipProvider>
      <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center gap-2 flex-wrap">
          {canGoBack ? (
            <BackButton onClick={() => router.history.back()} />
          ) : (
            <BackLink to="/apps" search={{}} ariaLabel="All apps" />
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Link to="/apps" search={{}} className="hover:text-foreground transition-colors">
              apps
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">{accountId}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-1">
            <Badge variant="secondary" className="font-mono text-xs">
              {apps.length} {apps.length === 1 ? "gateway" : "gateways"}
            </Badge>
            {readyCount > 0 && readyCount < apps.length && (
              <Badge variant="outline" className="text-xs">
                {readyCount} ready
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-foreground font-mono">{accountId}</h1>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(bosUri);
                toast.success("Copied bos:// address");
              }}
              className="font-mono text-[11px] h-auto py-0"
            >
              {bosUri}
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
          {apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No published gateways for{" "}
                <span className="font-mono text-foreground">{accountId}</span>.
              </p>
              <Button asChild variant="ghost" size="sm">
                <Link to="/apps" search={{}}>
                  back to registry
                </Link>
              </Button>
            </div>
          ) : (
            apps.map((app) => {
              const isTenant = app.extends === BASE_RUNTIME;
              const title = app.metadata?.title;

              return (
                <button
                  key={app.gatewayId}
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/apps/$accountId/$gatewayId",
                      params: { accountId, gatewayId: app.gatewayId },
                    })
                  }
                  className="w-full text-left hover:bg-muted/40 transition-colors group"
                  style={{ padding: "12px 16px" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                            app.status === "ready" ? "bg-green-500" : "bg-destructive"
                          }`}
                          title={app.status}
                        />
                        {isTenant && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            tenant
                          </Badge>
                        )}
                        {app.domain && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono px-1.5 py-0 h-4"
                          >
                            {app.domain}
                          </Badge>
                        )}
                      </div>
                      <div className="font-mono text-sm font-semibold text-foreground truncate">
                        {title ?? app.gatewayId}
                      </div>
                      {title && (
                        <div className="font-mono text-[11px] text-muted-foreground truncate">
                          {app.gatewayId}
                        </div>
                      )}
                      {app.metadata?.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {app.metadata.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {app.openUrl && (
                        <a
                          href={app.openUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hidden sm:inline-flex"
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1"
                            asChild
                          >
                            <span>
                              <ExternalLink size={10} />
                              open
                            </span>
                          </Button>
                        </a>
                      )}
                      <ArrowLeft
                        size={13}
                        className="text-muted-foreground rotate-180 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function AccountAppsPageSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4">
            <Skeleton className="h-14 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
