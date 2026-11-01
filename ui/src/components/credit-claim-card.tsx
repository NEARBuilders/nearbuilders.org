import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { ApiKeyReveal } from "@/components/api-key-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canRetry,
  claimCardCopy,
  creditStatusQueryKey,
  creditUsageQueryKey,
  formatUsd,
  needsProfileRestore,
  needsRegistration,
} from "@/lib/admin/credit-claims";
import {
  approvalSettingsQueryOptions,
  requiresAdminApproval,
} from "@/lib/queries/approval-settings";

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-foreground underline underline-offset-2 transition-colors hover:text-muted-foreground"
    >
      {children}
    </a>
  );
}

function GettingStartedNote() {
  return (
    <p className="px-1 text-xs leading-relaxed text-muted-foreground">
      Get started with the <ExtLink href="https://docs.near.ai">docs</ExtLink> and view the
      available <ExtLink href="https://cloud.near.ai/models">models</ExtLink>. New keys can take a
      few seconds to start working with NEAR AI Cloud.
    </p>
  );
}

function MoreCreditsNote() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Need more? Purchase with crypto or credit card on{" "}
      <ExtLink href="https://cloud.near.ai">cloud.near.ai</ExtLink>
    </p>
  );
}

function CreditUsageReadout({ userId, nearAccountId }: { userId: string; nearAccountId: string }) {
  const apiClient = useApiClient();
  const usage = useQuery({
    queryKey: creditUsageQueryKey(userId, nearAccountId),
    queryFn: () => apiClient.credits.getCreditUsage({}),
    staleTime: 60_000,
    retry: false,
  });

  if (usage.isLoading) {
    return (
      <div className="w-full shrink-0 space-y-1.5 sm:w-44">
        <Skeleton className="ml-auto h-3 w-28" />
        <Skeleton className="h-1.5 w-full" />
      </div>
    );
  }

  const data = usage.data?.usage;
  if (!data) {
    return (
      <p className="w-full shrink-0 text-xs text-muted-foreground sm:w-auto sm:text-right">
        usage unavailable
      </p>
    );
  }

  const percent = Math.min(100, Math.round((data.usedUsd / data.spendLimitUsd) * 100));
  return (
    <div className="w-full shrink-0 space-y-1.5 sm:w-44">
      <p className="text-xs font-medium whitespace-nowrap text-foreground sm:text-right">
        {formatUsd(data.usedUsd)} of {formatUsd(data.spendLimitUsd)} used
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Credits used"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function CreditClaimCard({
  userId,
  nearAccountId,
}: {
  userId: string;
  nearAccountId: string;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const creditStatusKey = creditStatusQueryKey(userId, nearAccountId);

  const status = useQuery({
    queryKey: creditStatusKey,
    queryFn: () => apiClient.credits.getCreditStatus({}),
  });

  const approvalSettings = useQuery(approvalSettingsQueryOptions(apiClient));

  const claim = useMutation({
    mutationFn: () => apiClient.credits.claimCredits({}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: creditStatusKey }),
    onError: (error: Error) => toast.error(error.message || "API credits could not be claimed"),
  });

  const replacement = useMutation({
    mutationFn: () => apiClient.credits.claimCreditReplacement({}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: creditStatusKey }),
    onError: (error: Error) => toast.error(error.message || "Replacement key could not be created"),
  });

  const revealed = claim.data ?? replacement.data;
  if (revealed) {
    return (
      <div className="space-y-2">
        <ApiKeyReveal
          apiKey={{
            id: revealed.claim.id,
            name: `NEAR AI Cloud · ${formatUsd(revealed.claim.spendLimitUsd)} credits`,
            prefix: revealed.claim.keyPrefix?.replace(/\*+$/, "") ?? null,
            start: null,
            key: revealed.key,
            createdAt: revealed.claim.createdAt,
          }}
          onDismiss={() => {
            claim.reset();
            replacement.reset();
          }}
        />
        <GettingStartedNote />
      </div>
    );
  }

  const data = status.data;
  if (status.isError) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-sm text-muted-foreground">Claim status could not be loaded.</p>
          <Button
            size="sm"
            variant="outline"
            disabled={status.isRefetching}
            onClick={() => void status.refetch()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const { available, amountUsd, eligibility, claim: existing } = data;
  const amount = formatUsd(amountUsd);
  const canClaim =
    canRetry(available, eligibility) &&
    (!existing || existing.status === "failed" || existing.status === "pending");
  const canReplace = existing?.status === "replaceable";

  if (!existing && !available) return null;

  const copy = claimCardCopy({
    amountUsd,
    available,
    statusReason: data.statusReason,
    eligibility,
    claimsCloseAt: data.claimsCloseAt,
    requiresReview: requiresAdminApproval(approvalSettings.data),
    nearAccountId,
    existing,
  });
  const registerCta = needsRegistration(eligibility, existing);
  const restoreCta = needsProfileRestore(eligibility, existing);

  return (
    <Card className="border-brand-accent-border">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
            <KeyRound className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{copy.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.description}</p>
            {existing?.status === "issued" && <MoreCreditsNote />}
          </div>
        </div>
        {existing?.status === "issued" && (
          <CreditUsageReadout userId={userId} nearAccountId={nearAccountId} />
        )}
        {canReplace && (
          <Button
            size="sm"
            className="w-full rounded-full sm:w-auto"
            disabled={replacement.isPending}
            onClick={() => replacement.mutate()}
          >
            {replacement.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <KeyRound className="size-3.5" />
            )}
            Save replacement key
          </Button>
        )}
        {registerCta && (
          <Button asChild size="sm" className="w-full rounded-full sm:w-auto">
            <Link to="/join">Register as a builder</Link>
          </Button>
        )}
        {restoreCta && (
          <Button asChild size="sm" variant="outline" className="w-full rounded-full sm:w-auto">
            <Link to="/builders/$account/edit" params={{ account: nearAccountId }}>
              Restore your builder profile
            </Link>
          </Button>
        )}
        {canClaim && existing?.status !== "pending" && (
          <Button
            size="sm"
            className="w-full rounded-full sm:w-auto"
            disabled={claim.isPending}
            onClick={() => claim.mutate()}
          >
            {claim.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <KeyRound className="size-3.5" />
            )}
            {existing ? "Try again" : `Claim ${amount}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
