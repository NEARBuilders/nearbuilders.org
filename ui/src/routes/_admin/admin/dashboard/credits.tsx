import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { type ApiClient, useApiClient } from "@/app";
import { useConfirmDialog } from "@/components";
import { RecordsState } from "@/components/admin/records-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pageHead } from "@/lib/page-meta";

type CreditClaim = Awaited<ReturnType<ApiClient["credits"]["listCreditClaims"]>>["data"][number];

const CLAIMS_KEY = ["admin-credit-claims"];
const PAGE_SIZE = 50;

const STATUS_VARIANTS: Record<CreditClaim["status"], "default" | "secondary" | "destructive"> = {
  issued: "default",
  expired: "secondary",
  pending: "secondary",
  failed: "destructive",
  revoked: "secondary",
};

export const Route = createFileRoute("/_admin/admin/dashboard/credits")({
  head: () => ({ meta: pageHead({ title: "API Credits · Admin Dashboard | NEAR Builders" }) }),
  component: CreditsTab,
});

function CreditsTab() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();

  const claims = useInfiniteQuery({
    queryKey: CLAIMS_KEY,
    queryFn: ({ pageParam }) =>
      apiClient.credits.listCreditClaims({ limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.meta.nextCursor ?? undefined,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiClient.credits.revokeCreditClaim({ id }),
    onSuccess: () => {
      toast.success("API key revoked");
      void queryClient.invalidateQueries({ queryKey: CLAIMS_KEY });
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = claims.data?.pages.flatMap((page) => page.data) ?? [];
  const total = claims.data?.pages[0]?.meta.total ?? 0;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">API credit claims</h2>
        <p className="text-sm text-muted-foreground">
          NEAR AI Cloud keys claimed by approved builders. Revoking a key stops it within a minute
          and the builder cannot claim again. {total > 0 && `${total} claims so far.`}
        </p>
      </div>
      <RecordsState
        isLoading={claims.isLoading}
        isError={claims.isError}
        isEmpty={rows.length === 0}
        onRetry={() => void claims.refetch()}
        loadingFallback={<Skeleton className="h-24 w-full" />}
        errorTitle="API credit claims could not be loaded"
        emptyTitle="No API credits claimed yet"
        emptyBody="Claims show up here as builders claim keys from their dashboard."
      >
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((claim) => (
            <li
              key={claim.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/builders/$account"
                    params={{ account: claim.nearAccountId }}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {claim.nearAccountId}
                  </Link>
                  <Badge variant={STATUS_VARIANTS[claim.status]}>{claim.status}</Badge>
                  {claim.ipClaimCount > 1 && (
                    <Badge variant="destructive">{claim.ipClaimCount} claims from this IP</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  ${claim.spendLimitUsd} · {claim.keyPrefix ? `${claim.keyPrefix} · ` : ""}
                  claimed {new Date(claim.createdAt).toLocaleString()}
                  {claim.ip ? ` · ${claim.ip}` : ""}
                </p>
                {claim.error && <p className="text-xs text-destructive">{claim.error}</p>}
              </div>
              {claim.status !== "revoked" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={revoke.isPending}
                  onClick={() =>
                    confirm({
                      title: "Revoke this API key?",
                      description: `The NEAR AI key for ${claim.nearAccountId} stops working within a minute, and they will not be able to claim credits again.`,
                      confirmLabel: "Revoke",
                      variant: "destructive",
                      onConfirm: () => revoke.mutate(claim.id),
                    })
                  }
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
        {claims.hasNextPage && (
          <Button
            size="sm"
            variant="outline"
            disabled={claims.isFetchingNextPage}
            onClick={() => void claims.fetchNextPage()}
          >
            {claims.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        )}
      </RecordsState>
      {dialog}
    </section>
  );
}
