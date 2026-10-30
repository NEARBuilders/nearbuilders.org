import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { ApiKeyReveal } from "@/components/api-key-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { claimCardCopy, formatUsd } from "@/lib/admin/credit-claims";

const CREDIT_STATUS_KEY = ["credit-status"];

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
        <p className="px-1 text-xs text-muted-foreground">
          New keys can take a few seconds to start working with NEAR AI Cloud.
        </p>
      </div>
    );
  }

  const { available, amountUsd, eligibility, claim: existing } = data;
  const amount = formatUsd(amountUsd);
  const canClaim =
    available &&
    eligibility === "eligible" &&
    (!existing || existing.status === "failed" || existing.status === "pending");

  if (!existing && !available) return null;

  const copy = claimCardCopy({
    amountUsd,
    available,
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
          </div>
        </div>
        {canClaim && (
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
