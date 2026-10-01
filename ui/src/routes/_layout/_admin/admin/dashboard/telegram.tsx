import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { useConfirmDialog } from "@/components";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RecordsState } from "../-records-state";

const REVIEWERS_KEY = ["admin-telegram-reviewers"];

export const Route = createFileRoute("/_layout/_admin/admin/dashboard/telegram")({
  head: () => ({ meta: [{ title: "Telegram · Admin Dashboard | NEAR Builders" }] }),
  component: TelegramTab,
});

function TelegramTab() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();

  const reviewers = useQuery({
    queryKey: REVIEWERS_KEY,
    queryFn: () => apiClient.listTelegramReviewers({}),
  });

  const remove = useMutation({
    mutationFn: (telegramId: number) => apiClient.removeTelegramReviewer({ telegramId }),
    onSuccess: () => {
      toast.success("Telegram access removed");
      void queryClient.invalidateQueries({ queryKey: REVIEWERS_KEY });
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = reviewers.data?.data ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Telegram reviewers</h2>
        <p className="text-sm text-muted-foreground">
          These Telegram accounts can approve and reject submissions from the admin group. An admin
          links their own account by sending /link to Chief in a private chat. Remove access here
          when someone stops being an admin.
        </p>
      </div>
      <RecordsState
        isLoading={reviewers.isLoading}
        isError={reviewers.isError}
        isEmpty={rows.length === 0}
        onRetry={() => void reviewers.refetch()}
        loadingFallback={<Skeleton className="h-24 w-full" />}
        errorTitle="Telegram reviewers could not be loaded"
        emptyTitle="No linked Telegram accounts"
        emptyBody="Send /link to Chief in a private chat to link yours."
      >
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((reviewer) => (
            <li
              key={reviewer.telegramId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {reviewer.telegramUsername
                    ? `@${reviewer.telegramUsername}`
                    : (reviewer.telegramName ?? reviewer.telegramId)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Acts as {reviewer.userLabel} · linked{" "}
                  {new Date(reviewer.linkedAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={remove.isPending}
                onClick={() =>
                  confirm({
                    title: "Remove Telegram access?",
                    description: `${reviewer.telegramUsername ? `@${reviewer.telegramUsername}` : "This account"} will no longer be able to approve or reject from Telegram. They can link again with /link while they are an admin.`,
                    confirmLabel: "Remove",
                    variant: "destructive",
                    onConfirm: () => remove.mutate(reviewer.telegramId),
                  })
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </RecordsState>
      {dialog}
    </section>
  );
}
