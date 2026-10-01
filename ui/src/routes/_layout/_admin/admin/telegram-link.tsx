import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleAlert, CircleCheck, Send } from "lucide-react";
import { useApiClient } from "@/app";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_layout/_admin/admin/telegram-link")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : "",
  }),
  head: () => ({ meta: [{ title: "Link Telegram | NEAR Builders" }] }),
  component: TelegramLinkPage,
});

function telegramHandle(account: { telegramUsername: string | null; telegramName: string | null }) {
  if (account.telegramUsername) return `@${account.telegramUsername}`;
  return account.telegramName ?? "this Telegram account";
}

function TelegramLinkPage() {
  const { code } = Route.useSearch();
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5" />
            Link Telegram
          </CardTitle>
          <CardDescription>
            A linked Telegram account can approve and reject submissions from the admin group, as
            you.
          </CardDescription>
        </CardHeader>
        <TelegramLinkBody code={code} />
      </Card>
    </div>
  );
}

function TelegramLinkBody({ code }: { code: string }) {
  const apiClient = useApiClient();

  const preview = useQuery({
    queryKey: ["telegram-link", code],
    queryFn: () => apiClient.getTelegramLink({ code }),
    enabled: code.length > 0,
    retry: false,
  });

  const confirm = useMutation({
    mutationFn: () => apiClient.confirmTelegramLink({ code }),
  });

  if (!code || preview.isError) {
    return (
      <CardContent>
        <p className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          This link has expired or was already used. Send /link to Chief in a private chat to get a
          new one.
        </p>
      </CardContent>
    );
  }

  if (preview.isLoading || !preview.data) {
    return (
      <CardContent className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
      </CardContent>
    );
  }

  const account = preview.data;
  const handle = telegramHandle(account);

  if (confirm.isSuccess) {
    return (
      <>
        <CardContent>
          <p className="flex items-start gap-2 text-sm text-foreground">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-cyan" />
            {handle} is linked. You can close this page and use the review buttons in Telegram.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/dashboard/telegram">View linked accounts</Link>
          </Button>
        </CardFooter>
      </>
    );
  }

  return (
    <>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
          <p className="text-lg font-semibold text-foreground">{handle}</p>
          <p className="text-sm text-muted-foreground">
            {account.telegramName ? `${account.telegramName} · ` : ""}Telegram ID{" "}
            {account.telegramId}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Only confirm if this is <span className="font-semibold text-foreground">your own</span>{" "}
          Telegram account. If someone sent you this link, don't confirm it.
        </p>
        {account.replaces ? (
          <p className="text-sm text-foreground">
            <span className="font-semibold">
              This replaces your current link to {telegramHandle(account.replaces)}.
            </span>{" "}
            That account will no longer be able to review from Telegram.
          </p>
        ) : null}
        {account.linkedAs ? (
          <p className="text-sm text-muted-foreground">
            This Telegram account is currently linked to {account.linkedAs}. Confirming moves it to
            your account.
          </p>
        ) : null}
        {confirm.isError ? (
          <p className="text-sm text-destructive">{confirm.error.message}</p>
        ) : null}
      </CardContent>
      <CardFooter className="gap-2">
        <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
          {confirm.isPending ? "Linking..." : `Link ${handle}`}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/admin/dashboard">Cancel</Link>
        </Button>
      </CardFooter>
    </>
  );
}
