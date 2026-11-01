import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { type ApiClient, useApiClient } from "@/app";
import { useConfirmDialog } from "@/components";
import { RecordsState } from "@/components/admin/records-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsd } from "@/lib/admin/credit-claims";
import {
  type CreditSettingsDraft,
  creditSettingsQueryKey,
  creditSettingsQueryOptions,
  draftToInput,
  nearAiSessionQueryKey,
  nearAiSessionQueryOptions,
  settingsDraft,
} from "@/lib/admin/credits-settings";
import { signNearAiLogin } from "@/lib/admin/near-ai-session";
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
      <NearAiSessionCard />
      <CreditSettingsCard />
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
                    {claim.usedUsd !== null && ` · ${formatUsd(claim.usedUsd)} used`}
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
      </section>
      {dialog}
    </section>
  );
}

const SESSION_BADGES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  valid: { label: "Session valid", variant: "default" },
  expired: { label: "Session expired", variant: "destructive" },
  absent: { label: "Not signed in", variant: "destructive" },
};

function NearAiSessionCard() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const session = useQuery(nearAiSessionQueryOptions(apiClient));

  const refresh = useMutation({
    mutationFn: async () => {
      const settings = await queryClient.fetchQuery(creditSettingsQueryOptions(apiClient));
      if (!settings.settings) {
        throw new Error("Save the credits settings first");
      }
      const loginInput = await signNearAiLogin(settings.settings.nearAiLoginAccountId);
      return apiClient.credits.loginNearAi(loginInput);
    },
    onSuccess: (result) => {
      toast.success("NEAR AI credentials refreshed", {
        description: result.refreshExpiresAt
          ? `Valid until ${new Date(result.refreshExpiresAt).toLocaleString()}`
          : undefined,
      });
      void queryClient.invalidateQueries({ queryKey: nearAiSessionQueryKey });
    },
    onError: (error) => toast.error(error.message),
  });

  const status = session.data?.status;
  const badge = status ? SESSION_BADGES[status] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-base">
          NEAR AI Cloud session
          {session.isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : badge ? (
            <Badge variant={badge.variant}>{badge.label}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          The server account that mints builder API keys. Refresh tokens expire after a week of
          inactivity — sign in again with the configured account when this shows expired.
          {session.data?.refreshExpiresAt &&
            status === "valid" &&
            ` Expires ${new Date(session.data.refreshExpiresAt).toLocaleString()}.`}
          {status === "valid" &&
            session.data?.usageReporting === false &&
            " Usage reporting is inactive — refreshing the credentials sets it up."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
          {refresh.isPending ? "Waiting for wallet…" : "Refresh credentials"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CreditSettingsCard() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(creditSettingsQueryOptions(apiClient));

  const [draft, setDraft] = useState<CreditSettingsDraft | null>(null);
  const savedDraft = settingsDraft(settingsQuery.data?.settings ?? null);
  const current = draft ?? savedDraft;

  const save = useMutation({
    mutationFn: (input: CreditSettingsDraft) =>
      apiClient.credits.updateCreditSettings(draftToInput(input)),
    onSuccess: () => {
      toast.success("Credits settings saved");
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: creditSettingsQueryKey });
    },
    onError: (error) => toast.error(error.message),
  });

  if (settingsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const field = (key: keyof CreditSettingsDraft, value: string | boolean) =>
    setDraft({ ...current, [key]: value } as CreditSettingsDraft);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuration</CardTitle>
        <CardDescription>
          {settingsQuery.data?.settings
            ? `Last updated ${new Date(settingsQuery.data.settings.updatedAt).toLocaleString()}${settingsQuery.data.settings.updatedBy ? ` by ${settingsQuery.data.settings.updatedBy}` : ""}.`
            : "Not configured yet — fill this in once to open the claim window."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="credits-amount">Claim amount (USD)</Label>
            <Input
              id="credits-amount"
              inputMode="decimal"
              value={current.amountUsd}
              onChange={(event) => field("amountUsd", event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="credits-enabled"
              checked={current.enabled}
              onCheckedChange={(checked) => field("enabled", checked === true)}
            />
            <Label htmlFor="credits-enabled" className="cursor-pointer">
              Claims open
            </Label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="credits-close-at">Claims close at (optional)</Label>
            <Input
              id="credits-close-at"
              type="datetime-local"
              value={current.claimsCloseAt}
              onChange={(event) => field("claimsCloseAt", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credits-key-expires">Keys expire at (optional)</Label>
            <Input
              id="credits-key-expires"
              type="datetime-local"
              value={current.keyExpiresAt}
              onChange={(event) => field("keyExpiresAt", event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="credits-workspace">NEAR AI workspace ID</Label>
            <Input
              id="credits-workspace"
              value={current.nearAiWorkspaceId}
              onChange={(event) => field("nearAiWorkspaceId", event.target.value)}
              placeholder="from the cloud.near.ai dashboard URL"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credits-login-account">NEAR AI login account</Label>
            <Input
              id="credits-login-account"
              value={current.nearAiLoginAccountId}
              onChange={(event) => field("nearAiLoginAccountId", event.target.value)}
              placeholder="nearbuilding.near"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="credits-org-id">NEAR AI organization ID (optional)</Label>
          <Input
            id="credits-org-id"
            value={current.nearAiOrgId}
            onChange={(event) => field("nearAiOrgId", event.target.value)}
            placeholder="auto-detected when credentials refresh — set only if usage stays unavailable"
          />
          <p className="text-xs text-muted-foreground">
            Used by usage reporting. Refreshing the NEAR AI credentials auto-detects it and creates
            a read-only reporting token.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={save.isPending || !draft}
            onClick={() => draft && save.mutate(draft)}
          >
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
          {draft && (
            <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
              Discard
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
