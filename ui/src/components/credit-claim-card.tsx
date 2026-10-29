import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { ApiKeyReveal } from "@/components/api-key-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClientValue } from "@/hooks";

const CREDITS_CLAIM_OPENS_AT = Date.parse("2026-11-01T00:00:00Z");
const CREDITS_CLAIM_CLOSES_AT = Date.parse("2026-11-14T23:59:00Z");
const CREDIT_STATUS_KEY = ["credit-status"];

function isClaimWindowOpen() {
  const now = Date.now();
  return now >= CREDITS_CLAIM_OPENS_AT && now < CREDITS_CLAIM_CLOSES_AT;
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount);
}

export function CreditClaimCard() {
  const windowOpen = useClientValue(isClaimWindowOpen, false);
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: CREDIT_STATUS_KEY,
    queryFn: () => apiClient.credits.getCreditStatus({}),
    enabled: windowOpen,
  });

  const claim = useMutation({
    mutationFn: () => apiClient.credits.claimCredits({}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: CREDIT_STATUS_KEY }),
    onError: (error: Error) => toast.error(error.message || "API credits could not be claimed"),
  });

  if (!windowOpen || !status.data) return null;

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

  const { available, amountUsd, eligibility, claim: existing } = status.data;
  const amount = formatUsd(amountUsd);
  const canClaim =
    available &&
    eligibility === "eligible" &&
    (!existing || existing.status === "failed" || existing.status === "pending");

  if (!existing && !available) return null;

  let title = canClaim
    ? `Claim ${amount} in NEAR AI Cloud credits`
    : `${amount} in NEAR AI Cloud credits`;
  let description = "Approved builders get one NEAR AI Cloud API key for the NEAR Hackathon.";
  if (existing?.status === "issued") {
    title = `${formatUsd(existing.spendLimitUsd)} NEAR AI Cloud credits claimed`;
    description = `Key ${existing.keyPrefix ?? ""} · claimed ${new Date(existing.createdAt).toLocaleDateString()} · expires ${new Date(existing.keyExpiresAt).toLocaleDateString()}`;
  } else if (existing?.status === "revoked") {
    title = "Your NEAR AI Cloud key was revoked";
    description = "Reach out to the NEAR Builders team if you think this is a mistake.";
  } else if (existing?.status === "pending") {
    description = "Your key is still being created. Try again in a couple of minutes.";
  } else if (existing?.status === "failed") {
    description = "The last attempt did not finish. You can try again.";
  } else if (eligibility === "needs_approved_profile") {
    description = "Credits are available once your builder profile is approved.";
  }

  return (
    <Card className="border-brand-accent-border">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
            <KeyRound className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
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
