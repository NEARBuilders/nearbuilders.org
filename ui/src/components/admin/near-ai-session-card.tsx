import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  creditSettingsQueryOptions,
  nearAiSessionQueryKey,
  nearAiSessionQueryOptions,
} from "@/lib/admin/credits-settings";
import { signNearAiLogin } from "@/lib/admin/near-ai-session";

const SESSION_BADGES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  valid: { label: "Session valid", variant: "default" },
  expired: { label: "Session expired", variant: "destructive" },
  absent: { label: "Not signed in", variant: "destructive" },
};

export function NearAiSessionCard({ compact = false }: { compact?: boolean }) {
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
  const needsAttention = status !== "valid" || session.data?.usageReporting === false;

  if (compact && (session.isLoading || !needsAttention)) return null;

  return (
    <Card className={compact ? "border-brand-accent-border" : undefined}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-3 text-base">
          NEAR AI Cloud session
          {session.isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : badge ? (
            <Badge variant={badge.variant}>{badge.label}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {compact
            ? status === "valid"
              ? "API credit keys are minted through this server account. Usage reporting is inactive — refreshing the credentials sets it up."
              : "API credit keys are minted through this server account, which is not signed in. Refresh the credentials to restore credit claims and usage reporting."
            : "The server account that mints builder API keys. Refresh tokens expire after a week of inactivity — sign in again with the configured account when this shows expired."}
          {session.data?.refreshExpiresAt &&
            status === "valid" &&
            ` Expires ${new Date(session.data.refreshExpiresAt).toLocaleString()}.`}
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
