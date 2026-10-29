import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const CATALOG_SENDS_KEY = ["admin-catalog-sends"];

type CatalogSend = Awaited<
  ReturnType<ReturnType<typeof useApiClient>["listCatalogListingSends"]>
>["data"][number];

function sendLabel(send: CatalogSend) {
  if (send.sendStatus === "failed") {
    return {
      text: send.sendAction === "remove" ? "Removal failed" : "Send failed",
      variant: "destructive" as const,
    };
  }
  if (send.sendStatus === "sent") {
    return send.sendAction === "remove"
      ? { text: "Removed", variant: "secondary" as const }
      : { text: "Sent", variant: "success" as const };
  }
  return { text: "Not sent", variant: "outline" as const };
}

function canRetry(send: CatalogSend) {
  return send.sendStatus === "failed" || send.sendStatus === null;
}

export function CatalogSends() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const sends = useQuery({
    queryKey: CATALOG_SENDS_KEY,
    queryFn: () => apiClient.listCatalogListingSends(),
  });

  const retry = useMutation({
    mutationFn: (send: CatalogSend) =>
      apiClient.retryCatalogListingSend({ kind: send.kind, entityId: send.entityId }),
    onSuccess: (result) => {
      if (result.data.sendStatus === "failed") {
        toast.error(result.data.sendError ?? "NEAR Catalog did not accept it");
      } else {
        toast.success("Sent to NEAR Catalog");
      }
      void queryClient.invalidateQueries({ queryKey: CATALOG_SENDS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["admin-proposals"] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (sends.isLoading) return <Skeleton className="h-20 w-full" />;
  if (sends.isError || !sends.data) return null;

  const { enabled, data } = sends.data;
  const failed = data.filter((send) => send.sendStatus === "failed").length;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">Sending to NEAR Catalog</h3>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? "Approved listings are sent to NEAR Catalog. Rejected, withdrawn or private ones are removed there."
              : "Off. Approved listings stay here and in the export until a NEAR Catalog API URL and token are set."}
          </p>
        </div>
        {failed > 0 ? <Badge variant="destructive">{failed} failed</Badge> : null}
      </div>
      {data.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.map((send) => {
            const label = sendLabel(send);
            const pending =
              retry.isPending &&
              retry.variables?.kind === send.kind &&
              retry.variables?.entityId === send.entityId;
            return (
              <li
                key={`${send.kind}:${send.entityId}`}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">{send.title}</p>
                    <Badge variant="secondary">
                      {send.kind === "project" ? "Project" : "Person"}
                    </Badge>
                    <Badge variant={label.variant}>{label.text}</Badge>
                  </div>
                  {send.sendError && send.sendStatus === "failed" ? (
                    <p className="text-sm text-destructive">{send.sendError}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {send.sendAttemptedAt
                      ? `Last try ${new Date(send.sendAttemptedAt).toLocaleString()}`
                      : "Approved before sending was set up"}
                    {send.catalogUrl && send.sendAction !== "remove" ? (
                      <>
                        {" · "}
                        <a
                          href={send.catalogUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          View on NEAR Catalog
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                {enabled && canRetry(send) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(send)}
                  >
                    {pending ? "Sending..." : send.sendStatus === "failed" ? "Retry" : "Send"}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
