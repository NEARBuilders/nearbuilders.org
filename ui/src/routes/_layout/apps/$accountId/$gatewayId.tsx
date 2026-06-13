import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Info } from "lucide-react";
import type { TransactionBuilder } from "near-kit";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { BackButton, BackLink, Badge, Button, CommandCopy } from "@/components";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";

const BASE_RUNTIME = "bos://dev.everything.near/everything.dev";

const getStartCommand = (accountId: string, gatewayId: string) =>
  `bunx everything-dev@latest start --account ${accountId} --domain ${gatewayId}`;

const getExtendsCommand = (accountId: string, gatewayId: string) =>
  `bunx everything-dev@latest init --extends bos://${accountId}/${gatewayId}`;

export const Route = createFileRoute("/_layout/apps/$accountId/$gatewayId")({
  loader: async ({ params, context }) => {
    const { queryClient, apiClient } = context;
    await queryClient.prefetchQuery({
      queryKey: ["app", params.accountId, params.gatewayId],
      queryFn: () =>
        apiClient.getRegistryApp({
          accountId: params.accountId,
          gatewayId: params.gatewayId,
        }),
      staleTime: 30_000,
    });
    return { accountId: params.accountId, gatewayId: params.gatewayId };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    return {
      meta: [
        {
          title: `${loaderData.accountId} / ${loaderData.gatewayId} | Apps | everything.dev`,
        },
        {
          name: "description",
          content: `Runtime details for bos://${loaderData.accountId}/${loaderData.gatewayId} — inspect host, UI, API, and plugin composition.`,
        },
      ],
    };
  },
  component: AppDetailPage,
});

function AppDetailPage() {
  const { accountId, gatewayId } = Route.useParams();
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = router.history.canGoBack?.() ?? false;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);

  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const user = session?.user;

  const appQuery = useSuspenseQuery({
    queryKey: ["app", accountId, gatewayId],
    queryFn: () => apiClient.getRegistryApp({ accountId, gatewayId }),
    staleTime: 30_000,
  });

  const projectsQuery = useQuery({
    queryKey: ["app-projects", accountId, gatewayId],
    queryFn: () => apiClient.listProjectsForApp({ accountId, domain: gatewayId }),
  });

  const statusQuery = useQuery({
    queryKey: ["registry-status"],
    queryFn: () => apiClient.getRegistryStatus(),
    staleTime: 60_000,
  });

  const app = appQuery.data?.data;

  const [title, setTitle] = useState(app?.metadata?.title ?? "");
  const [description, setDescription] = useState(app?.metadata?.description ?? "");
  const [repoUrl, setRepoUrl] = useState(app?.metadata?.repoUrl ?? "");
  const [homepageUrl, setHomepageUrl] = useState(app?.metadata?.homepageUrl ?? app?.openUrl ?? "");
  const [imageUrl, setImageUrl] = useState(app?.metadata?.imageUrl ?? "");
  const [delegatePayload, setDelegatePayload] = useState<string | null>(null);

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center sm:px-6">
        <p className="text-base font-semibold text-foreground">App not found.</p>
        <Button asChild variant="ghost" size="sm">
          <Link to="/apps" search={{}}>
            ← back to apps
          </Link>
        </Button>
      </div>
    );
  }

  const isTenant = app.extends === BASE_RUNTIME;
  const bosUri = `bos://${accountId}/${gatewayId}`;
  const displayTitle = app.metadata?.title ?? `${accountId} / ${gatewayId}`;
  const startCommand = getStartCommand(accountId, gatewayId);
  const extendsCommand = getExtendsCommand(accountId, gatewayId);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["app", accountId, gatewayId] }),
      queryClient.invalidateQueries({ queryKey: ["apps-account", accountId] }),
      queryClient.invalidateQueries({ queryKey: ["apps"] }),
    ]);
  };

  const prepareMetadataMutation = useMutation({
    mutationFn: async () => {
      if (!nearAccountId) throw new Error("Connect a NEAR wallet to publish metadata.");
      return apiClient.prepareRegistryMetadataWrite({
        accountId,
        gatewayId,
        claimedBy: nearAccountId,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
        homepageUrl: homepageUrl.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const prepared = await prepareMetadataMutation.mutateAsync();
      const signed = await auth.near.buildSignedDelegateAction(
        prepared.data.contractId,
        (builder: TransactionBuilder) =>
          builder.functionCall(
            prepared.data.contractId,
            prepared.data.methodName,
            prepared.data.args,
            { gas: "10000000000000", attachedDeposit: 0n },
          ),
      );
      const result = await auth.near.relayTransaction({ payload: signed });
      if (result.error) throw new Error(result.error.message || "Relay failed");
      return result.data;
    },
    onSuccess: async (result) => {
      setDelegatePayload(null);
      toast.success("Metadata submitted", {
        description: result?.txHash ? `tx: ${result.txHash}` : "Indexing may take a moment.",
      });
      await refreshQueries();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to publish"),
  });

  const signDelegateMutation = useMutation({
    mutationFn: async () => {
      const prepared = await prepareMetadataMutation.mutateAsync();
      return auth.near.buildSignedDelegateAction(
        prepared.data.contractId,
        (builder: TransactionBuilder) =>
          builder.functionCall(
            prepared.data.contractId,
            prepared.data.methodName,
            prepared.data.args,
            { gas: "10000000000000", attachedDeposit: 0n },
          ),
      );
    },
    onSuccess: (payload: string) => {
      setDelegatePayload(payload);
      toast.success("Payload signed — relay below or copy to submit elsewhere.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to sign"),
  });

  const relayMutation = useMutation({
    mutationFn: async () => {
      if (!delegatePayload) throw new Error("Sign a payload first.");
      const result = await auth.near.relayTransaction({ payload: delegatePayload });
      if (result.error) throw new Error(result.error.message || "Relay failed");
      return result.data;
    },
    onSuccess: async (result) => {
      toast.success("Relayed", {
        description: result?.txHash ? `tx: ${result.txHash}` : undefined,
      });
      await refreshQueries();
    },
    onError: (err: Error) => toast.error(err.message || "Relay failed"),
  });

  const isAnyPending =
    publishMutation.isPending || signDelegateMutation.isPending || relayMutation.isPending;

  const resolvedConfig = app.resolvedConfig as Record<string, unknown>;
  const configApp = resolvedConfig?.app as Record<string, unknown> | undefined;
  const configPlugins = resolvedConfig?.plugins as Record<string, unknown> | undefined;

  const metaPanel = (
    <div className="space-y-4 text-sm">
      <MetaSectionLabel>Details</MetaSectionLabel>
      <MetaRow label="Status">
        <Badge variant={app.status === "ready" ? "default" : "destructive"} className="text-xs">
          {app.status}
        </Badge>
      </MetaRow>
      {isTenant && (
        <MetaRow label="Type">
          <Badge variant="outline" className="text-xs">
            tenant runtime
          </Badge>
        </MetaRow>
      )}
      {app.extends && (
        <MetaRow label="Extends">
          <code className="font-mono text-xs break-all text-foreground">{app.extends}</code>
        </MetaRow>
      )}
      {app.domain && (
        <MetaRow label="Domain">
          <span className="font-mono text-xs">{app.domain}</span>
        </MetaRow>
      )}
      {app.metadata?.claimedBy && (
        <MetaRow label="Claimed by">
          <span className="font-mono text-xs">{app.metadata.claimedBy}</span>
        </MetaRow>
      )}
      {app.metadata?.updatedAt && (
        <MetaRow label="Updated">{new Date(app.metadata.updatedAt).toLocaleDateString()}</MetaRow>
      )}
      <MetaRow label="Relay">
        {statusQuery.data?.relayEnabled ? (
          <Badge variant="secondary" className="text-xs">
            enabled
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">disabled</span>
        )}
      </MetaRow>
      <div className="pt-1 space-y-1.5">
        <MetaSectionLabel>FastKV key</MetaSectionLabel>
        <code className="block font-mono text-[10px] text-muted-foreground break-all bg-muted/30 rounded px-2 py-1.5">
          {app.canonicalKey}
        </code>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div className="flex items-center gap-2">
            {canGoBack ? (
              <BackButton onClick={() => router.history.back()} />
            ) : (
              <BackLink to="/apps/$accountId" params={{ accountId }} ariaLabel="All apps" />
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Link to="/apps" search={{}} className="hover:text-foreground transition-colors">
                apps
              </Link>
              <span>/</span>
              <Link
                to="/apps/$accountId"
                params={{ accountId }}
                className="hover:text-foreground transition-colors"
              >
                {accountId}
              </Link>
              <span>/</span>
              <span className="text-foreground font-semibold">{gatewayId}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {app.openUrl && (
              <Button asChild size="sm" className="h-8 gap-1.5">
                <a href={app.openUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={11} />
                  open app
                </a>
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5"
              onClick={async () => {
                await navigator.clipboard.writeText(startCommand);
                setCopiedCmd(true);
                toast.success("Copied start command");
                setTimeout(() => setCopiedCmd(false), 2000);
              }}
            >
              {copiedCmd ? <Check size={11} /> : <Copy size={11} />}
              <span className="hidden sm:inline">start command</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="sm:hidden"
              onClick={() => setDetailsOpen(true)}
              aria-label="App details"
            >
              <Info size={14} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-6">
          <div className="space-y-6 min-w-0">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                    app.status === "ready" ? "bg-green-500" : "bg-destructive"
                  }`}
                />
                {isTenant && (
                  <Badge variant="outline" className="text-xs">
                    tenant
                  </Badge>
                )}
                {app.metadata?.claimedBy ? (
                  <Badge variant="secondary" className="text-xs">
                    claimed by {app.metadata.claimedBy}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    unclaimed
                  </Badge>
                )}
              </div>

              <h1 className="text-xl font-bold text-foreground break-all">{displayTitle}</h1>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(bosUri);
                  setCopiedUri(true);
                  toast.success("Copied bos:// address");
                  setTimeout(() => setCopiedUri(false), 2000);
                }}
                className="font-mono"
              >
                <code className="text-xs">{bosUri}</code>
                {copiedUri ? (
                  <Check size={11} className="shrink-0 text-green-500" />
                ) : (
                  <Copy size={11} className="shrink-0 opacity-60" />
                )}
              </Button>

              {app.metadata?.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {app.metadata.description}
                </p>
              )}

              <div className="flex gap-3 flex-wrap">
                {app.metadata?.repoUrl && (
                  <a
                    href={app.metadata.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    repository
                  </a>
                )}
                {app.metadata?.homepageUrl && (
                  <a
                    href={app.metadata.homepageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    homepage
                  </a>
                )}
                <a
                  href={app.canonicalConfigUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  FastKV config
                </a>
              </div>
            </div>

            {isTenant && (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-foreground">Tenant runtime</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This app extends{" "}
                  <Button
                    type="button"
                    variant="link"
                    onClick={() =>
                      void navigate({
                        to: "/apps/$accountId/$gatewayId",
                        params: {
                          accountId: "dev.everything.near",
                          gatewayId: "everything.dev",
                        },
                      })
                    }
                  >
                    bos://dev.everything.near/everything.dev
                  </Button>
                  . The shared host serves a custom UI at{" "}
                  {app.domain ? (
                    <a
                      href={`https://${app.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-foreground hover:underline"
                    >
                      {app.domain}
                    </a>
                  ) : (
                    <span className="font-mono">{accountId}.everything.dev</span>
                  )}{" "}
                  while keeping the base auth, API, and plugins intact.
                </p>
              </div>
            )}

            <section className="space-y-2">
              <SectionLabel>Runtime</SectionLabel>
              <div className="space-y-1.5">
                <RuntimeRow label="host" value={app.hostUrl} />
                <RuntimeRow label="ui" value={app.uiUrl} />
                <RuntimeRow label="api" value={app.apiUrl} />
                {app.uiSsrUrl && <RuntimeRow label="ssr" value={app.uiSsrUrl} />}
                {app.extends && (
                  <RuntimeRow label="extends" value={app.extends} isUrl={false} mono />
                )}
              </div>
            </section>

            <section className="space-y-2">
              <SectionLabel>Start command</SectionLabel>
              <CommandCopy command={startCommand} />
            </section>

            <section className="space-y-2">
              <SectionLabel>Extends command</SectionLabel>
              <CommandCopy command={extendsCommand} />
            </section>

            {configApp && (
              <section className="space-y-2">
                <SectionLabel>Resolved bos.config.json</SectionLabel>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/30 px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      apps/{accountId}/{gatewayId}/bos.config.json
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfigExpanded((v) => !v)}
                      className="text-[11px] h-auto py-0"
                    >
                      {configExpanded ? "collapse" : "expand"}
                    </Button>
                  </div>

                  <div className="divide-y divide-border">
                    {(["host", "ui", "api", "auth"] as const).map((key) => {
                      const val = configApp[key] as Record<string, unknown> | undefined;
                      if (!val) return null;
                      const prod = val.production as string | undefined;
                      if (!prod) return null;
                      return (
                        <div key={key} className="flex items-start gap-2 px-3 py-2 text-xs">
                          <span
                            className="font-mono text-muted-foreground shrink-0 uppercase font-semibold min-w-[36px]"
                            style={{ fontSize: 10 }}
                          >
                            {key}
                          </span>
                          <a
                            href={prod}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-foreground hover:underline break-all"
                          >
                            {prod}
                          </a>
                        </div>
                      );
                    })}

                    {configPlugins && Object.keys(configPlugins).length > 0 && (
                      <div className="px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">
                          plugins
                        </div>
                        <div className="space-y-1">
                          {Object.entries(configPlugins).map(([id, val]) => {
                            const pluginVal = val as Record<string, unknown> | undefined;
                            const prod = pluginVal?.production as string | undefined;
                            return (
                              <div key={id} className="flex items-center gap-2 text-xs">
                                <span
                                  className="font-mono text-muted-foreground shrink-0"
                                  style={{ fontSize: 10 }}
                                >
                                  {id}
                                </span>
                                {prod ? (
                                  <a
                                    href={prod}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-foreground hover:underline break-all"
                                    style={{ fontSize: 10 }}
                                  >
                                    {prod}
                                  </a>
                                ) : (
                                  <span
                                    className="text-muted-foreground font-mono"
                                    style={{ fontSize: 10 }}
                                  >
                                    inherited
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {configExpanded && (
                    <div className="border-t border-border">
                      <pre
                        className="overflow-x-auto p-4 font-mono text-muted-foreground whitespace-pre"
                        style={{ fontSize: 10, lineHeight: "1.7" }}
                      >
                        {JSON.stringify(resolvedConfig, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </section>
            )}

            {projectsQuery.data !== undefined && (
              <section className="space-y-2">
                <SectionLabel>In Projects</SectionLabel>
                {projectsQuery.isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : projectsQuery.data?.data && projectsQuery.data.data.length > 0 ? (
                  <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                    {projectsQuery.data.data.map((project) => (
                      <Link
                        key={project.id}
                        to="/projects/$kind/$id"
                        params={{ kind: project.kind, id: project.id }}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-sm font-medium text-foreground truncate">
                            {project.title}
                          </div>
                          {project.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {project.description}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                          {project.status}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not linked to any projects yet.</p>
                )}
              </section>
            )}

            <section className="space-y-3">
              <SectionLabel>Claim / Edit Metadata</SectionLabel>
              {!user ? (
                <p className="text-sm text-muted-foreground">
                  Sign in and link a NEAR wallet to publish metadata for this app.
                </p>
              ) : !nearAccountId ? (
                <p className="text-sm text-muted-foreground">
                  No NEAR wallet linked.{" "}
                  <Link to="/settings" className="text-foreground hover:underline">
                    Open settings
                  </Link>{" "}
                  to connect one.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Title" htmlFor="meta-title">
                      <Input
                        id="meta-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="App title"
                        className="h-9 text-sm"
                      />
                    </FormField>
                    <FormField label="Repo URL" htmlFor="meta-repo">
                      <Input
                        id="meta-repo"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/..."
                        className="h-9 text-sm"
                      />
                    </FormField>
                    <FormField label="Homepage URL" htmlFor="meta-homepage">
                      <Input
                        id="meta-homepage"
                        value={homepageUrl}
                        onChange={(e) => setHomepageUrl(e.target.value)}
                        placeholder="https://..."
                        className="h-9 text-sm"
                      />
                    </FormField>
                    <FormField label="Image URL" htmlFor="meta-image">
                      <Input
                        id="meta-image"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://..."
                        className="h-9 text-sm"
                      />
                    </FormField>
                  </div>
                  <FormField label="Description" htmlFor="meta-desc">
                    <Textarea
                      id="meta-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Short description"
                    />
                  </FormField>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => publishMutation.mutate()}
                      disabled={isAnyPending}
                      size="sm"
                    >
                      {publishMutation.isPending ? "Publishing..." : "Publish now"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => signDelegateMutation.mutate()}
                      disabled={isAnyPending}
                    >
                      {signDelegateMutation.isPending ? "Signing..." : "Sign delegate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => relayMutation.mutate()}
                      disabled={!statusQuery.data?.relayEnabled || !delegatePayload || isAnyPending}
                    >
                      {relayMutation.isPending ? "Relaying..." : "Relay payload"}
                    </Button>
                  </div>

                  {delegatePayload && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                          Signed delegate payload
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={async () => {
                            await navigator.clipboard.writeText(delegatePayload);
                            toast.success("Payload copied");
                          }}
                        >
                          <Copy size={10} />
                          copy
                        </Button>
                      </div>
                      <pre
                        className="overflow-x-auto rounded border border-border bg-muted/10 p-3 font-mono text-foreground whitespace-pre-wrap break-all"
                        style={{ fontSize: 10, lineHeight: "1.5", maxHeight: 140 }}
                      >
                        {delegatePayload}
                      </pre>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Direct publish uses <code className="font-mono">waitUntil: NONE</code>. The
                    wallet may report failure while FastKV still indexes the transaction
                    successfully.
                  </p>
                </div>
              )}
            </section>
          </div>

          <div className="hidden sm:block">
            <div className="sticky top-4 space-y-0 border border-border rounded-lg overflow-hidden bg-card">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Details
                </span>
              </div>
              <div className="px-4 py-4">{metaPanel}</div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-sm">Details</SheetTitle>
            <SheetClose />
          </SheetHeader>
          {metaPanel}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
      {children}
    </div>
  );
}

function MetaSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-foreground">{children}</div>
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
    <div className="flex items-start gap-2 rounded border border-border bg-muted/10 px-2.5 py-1.5 text-xs">
      <span
        className="text-muted-foreground uppercase tracking-wide shrink-0 pt-px font-semibold min-w-[40px]"
        style={{ fontSize: 10 }}
      >
        {label}
      </span>
      {looksLikeUrl ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
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

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs uppercase tracking-wide text-muted-foreground font-semibold"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
