import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookCheck, Clock3, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button } from "@/components/ui/button";
import { type CatalogListingTarget, catalogListingQueryKey } from "@/lib/catalog-listing";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function CatalogListingPanel({
  target,
  visible,
  version,
  editAction,
}: {
  target: CatalogListingTarget;
  visible: boolean;
  version?: string;
  editAction?: ReactNode;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = catalogListingQueryKey(target);
  const statusQuery = useQuery({
    queryKey: [...queryKey, version ?? ""],
    queryFn: async () => (await apiClient.getMyCatalogListing(target)).data,
    enabled: visible,
    retry: false,
  });
  const onSettled = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["catalog-listings"] });
  };
  const submit = useMutation({
    mutationFn: async () => (await apiClient.submitCatalogListing(target)).data,
    onSuccess: () => toast.success("Sent to NEAR Builders admins for NEAR Catalog review"),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled,
  });
  const withdraw = useMutation({
    mutationFn: async () => (await apiClient.withdrawMyCatalogListing(target)).data,
    onSuccess: () => toast.success("Taken out of NEAR Catalog"),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled,
  });

  const status = statusQuery.data;
  if (!visible || !status) return null;

  const busy = submit.isPending || withdraw.isPending;
  const subject = target.kind === "person" ? "profile" : "project";
  const ready = status.eligible && status.missing.length === 0;
  const submitButton = (label: string) => (
    <Button size="sm" className="w-fit" disabled={!ready || busy} onClick={() => submit.mutate()}>
      {submit.isPending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
  const withdrawButton = (label: string) => (
    <Button
      size="sm"
      variant="outline"
      className="w-fit"
      disabled={busy}
      onClick={() => withdraw.mutate()}
    >
      {withdraw.isPending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );

  let icon = <BookCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />;
  let title = "List on NEAR Catalog";
  let body = `A NEAR Builders admin reviews your ${subject} before it goes to NEAR Catalog.`;
  let actions: ReactNode = submitButton("Submit to NEAR Catalog");

  if (status.status === "pending") {
    icon = <Clock3 className="mt-0.5 size-5 shrink-0 text-brand-accent" />;
    title = status.listed ? "Changes waiting for review" : "Waiting for NEAR Catalog review";
    body = status.listed
      ? "Your last approved version stays listed until an admin reviews the changes."
      : `A NEAR Builders admin will review your ${subject} for NEAR Catalog.`;
    actions = withdrawButton(status.listed ? "Remove from NEAR Catalog" : "Withdraw");
  } else if (status.status === "approved" || status.status === "published") {
    icon = <BookCheck className="mt-0.5 size-5 shrink-0 text-brand-accent" />;
    title = status.status === "published" ? "On NEAR Catalog" : "Approved for NEAR Catalog";
    body =
      "Changes to the title, tagline, logo, categories or links go back to review. Other edits update the listing.";
    actions = withdrawButton("Remove from NEAR Catalog");
  } else if (status.status === "rejected") {
    icon = <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />;
    title = "Not approved for NEAR Catalog";
    body = status.rejectionReason
      ? `Reason: ${status.rejectionReason}`
      : "An admin did not approve this listing. Update it and submit again.";
    actions = submitButton("Submit again");
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
      {icon}
      <div className="min-w-0 space-y-2">
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
        {status.status !== "pending" &&
          status.status !== "approved" &&
          status.status !== "published" &&
          !ready && (
            <p className="text-xs text-muted-foreground">
              {status.ineligibleReason ?? `Still missing: ${status.missing.join(", ")}`}
            </p>
          )}
        <div className="flex flex-wrap gap-2">
          {actions}
          {!ready && status.eligible && editAction}
        </div>
      </div>
    </div>
  );
}
