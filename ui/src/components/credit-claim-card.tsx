import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { ApiKeyReveal } from "@/components/api-key-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { canRetry, claimCardCopy, formatUsd } from "@/lib/admin/credit-claims";

const CREDIT_STATUS_KEY = ["credit-status"];

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

export function CreditClaimCard() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: CREDIT_STATUS_KEY,
    queryFn: () => apiClient.credits.getCreditStatus({}),
  });

  const claim = useMutation({
    mutationFn: () => apiClient.credits.claimCredits({}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: CREDIT_STATUS_KEY }),
    onError: (error: Error) => toast.error(error.message || "API credits could not be claimed"),
  });

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

  if (claim.data) {
    return (
      <div className="space-y-2">
        <ApiKeyReveal
          apiKey={{
            id: claim.data.claim.id,
            name: `NEAR AI Cloud · ${formatUsd(claim.data.claim.spendLimitUsd)} credits`,
            prefix: claim.data.claim.keyPrefix?.replace(/\*+$/, "") ?? null,
            start: null,
            key: claim.data.key,
            createdAt: claim.data.claim.createdAt,
          }}
          onDismiss={() => claim.reset()}
        />
        <GettingStartedNote />
      </div>
    );
  }

  const { available, amountUsd, eligibility, claim: existing } = data;
  const amount = formatUsd(amountUsd);
  const canClaim =
    canRetry(available, eligibility) &&
    (!existing || existing.status === "failed" || existing.status === "pending");

  if (!existing && !available) return null;

  const copy = claimCardCopy({
    amountUsd,
    available,
    statusReason: data.statusReason,
    eligibility,
    claimsCloseAt: data.claimsCloseAt,
    existing,
  });

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
