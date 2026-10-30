import type { ApiClient } from "@/app";

export type CreditStatus = Awaited<ReturnType<ApiClient["credits"]["getCreditStatus"]>>;
export type ClaimView = NonNullable<CreditStatus["claim"]>;

export function formatUsd(amount: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount);
}

export function windowCopy(
  statusReason: NonNullable<CreditStatus["statusReason"]>,
  claimsCloseAt: string | null,
): string {
  switch (statusReason) {
    case "not_enabled":
      return "API credit claims are not open yet.";
    case "not_configured":
      return "API credit claims are not configured yet.";
    case "closed":
      return claimsCloseAt
        ? `The claim window closed ${new Date(claimsCloseAt).toLocaleDateString()}.`
        : "The claim window has closed.";
  }
}

export function claimCardCopy({
  amountUsd,
  available,
  statusReason,
  eligibility,
  claimsCloseAt,
  existing,
}: {
  amountUsd: number;
  available: boolean;
  statusReason: CreditStatus["statusReason"];
  eligibility: CreditStatus["eligibility"];
  claimsCloseAt: string | null;
  existing: Pick<
    ClaimView,
    "status" | "keyPrefix" | "createdAt" | "keyExpiresAt" | "spendLimitUsd"
  > | null;
}): { title: string; description: string } {
  const amount = formatUsd(amountUsd);
  let title = `Claim ${amount} in NEAR AI Cloud credits`;
  let description = "Approved builders get one NEAR AI Cloud API key for the NEAR Hackathon.";

  if (eligibility === "needs_approved_profile") {
    description = "Credits are available once your builder profile is approved.";
  } else if (eligibility === "needs_near_account") {
    description = "Link a NEAR account to claim API credits.";
  } else if (!available && statusReason) {
    description = windowCopy(statusReason, claimsCloseAt);
  } else if (claimsCloseAt) {
    description += ` Offering closes ${new Date(claimsCloseAt).toLocaleDateString()}.`;
  }

  switch (existing?.status) {
    case "issued":
      title = `${formatUsd(existing.spendLimitUsd)} NEAR AI Cloud credits claimed`;
      description = `Key ${existing.keyPrefix ?? ""} · claimed ${new Date(existing.createdAt).toLocaleDateString()} · expires ${new Date(existing.keyExpiresAt).toLocaleDateString()}`;
      break;
    case "expired":
      title = "Your NEAR AI Cloud key has expired";
      description = `Key ${existing.keyPrefix ?? ""} expired ${new Date(existing.keyExpiresAt).toLocaleDateString()}. Each builder can claim credits once.`;
      break;
    case "revoked":
      title = "Your NEAR AI Cloud key was revoked";
      description = "Reach out to the NEAR Builders team if you think this is a mistake.";
      break;
    case "pending":
      title = "Your claim is being processed";
      if (canRetry(available, eligibility)) {
        description = "Your key is still being created. Try again in a couple of minutes.";
      }
      break;
    case "failed":
      if (canRetry(available, eligibility)) {
        title = "You can try claiming again";
        description = "The last attempt did not finish. You can try again.";
      }
      break;
  }

  return { title, description };
}

export function canRetry(available: boolean, eligibility: CreditStatus["eligibility"]): boolean {
  return available && eligibility === "eligible";
}
