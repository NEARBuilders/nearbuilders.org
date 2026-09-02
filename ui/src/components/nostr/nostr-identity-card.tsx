import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Key, Link2, Loader2, PlusCircle, XCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuthClient } from "@/app";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/ui/info-row";
import {
  buildTxArgs,
  clearSession,
  createBindingChallenge,
  generateAndStore,
  getBinding,
  loadSession,
  secretKeyBytes,
  signBindingChallenge,
} from "@/lib/nostr";
import { DEFAULT_RELAYS } from "@/lib/nostr/types";

export function NostrIdentityCard({
  nearAccountId,
  onKeyChange,
}: {
  nearAccountId: string;
  onKeyChange?: () => void;
}) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const [linking, setLinking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const session = useMemo(() => loadSession(nearAccountId), [nearAccountId, refreshKey]);

  const { data: binding, isLoading: bindingLoading } = useQuery({
    queryKey: ["nostr-binding", nearAccountId],
    queryFn: () => getBinding(nearAccountId),
    staleTime: 60_000,
  });

  const isLinked = !!binding?.nostrPubkey;
  const boundToCurrentKey = isLinked && binding?.nostrPubkey === session?.pubkey;

  const handleLink = useCallback(async () => {
    if (!nearAccountId || !session) return;
    setLinking(true);
    try {
      const { challenge } = createBindingChallenge(nearAccountId);
      const event = signBindingChallenge(secretKeyBytes(session), challenge);

      const { contract, method, args } = buildTxArgs({
        nearAccountId,
        nostrPubkey: session.pubkey,
        proof: event.id,
        relay: DEFAULT_RELAYS[0],
      });

      const payload = await auth.near.buildSignedDelegateAction(contract, (builder, receiverId) =>
        builder.functionCall(receiverId, method, args, {
          gas: "300 Tgas",
          attachedDeposit: "0.01 NEAR",
        }),
      );

      await auth.near.relayTransaction({ payload });
      await queryClient.invalidateQueries({ queryKey: ["nostr-binding", nearAccountId] });
      toast.success("Nostr identity linked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Link failed");
    } finally {
      setLinking(false);
    }
  }, [auth.near, nearAccountId, queryClient, session]);

  const bindingValue = bindingLoading
    ? "checking…"
    : isLinked
      ? boundToCurrentKey
        ? "linked"
        : `linked to ${binding.nostrPubkey.slice(0, 12)}…`
      : "not linked";

  return (
    <div className="p-6 border border-border rounded-[10px] space-y-4 bg-card">
      <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
        <Key className="h-3 w-3" />
        Nostr Identity
      </div>

      <div className="space-y-2">
        <InfoRow label="NEAR Account" value={nearAccountId} mono />
        <InfoRow
          label="Nostr Pubkey"
          value={session?.pubkey ? `${session.pubkey.slice(0, 16)}...` : "—"}
          mono
        />
        <InfoRow
          label="Binding"
          value={
            <span className="flex items-center gap-1">
              {isLinked ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="h-3 w-3 text-muted-foreground" />
              )}
              {bindingValue}
            </span>
          }
        />
        <InfoRow
          label="Local Key"
          value={
            <span className="flex items-center gap-1">
              {session ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="h-3 w-3 text-muted-foreground" />
              )}
              {session ? "stored" : "none"}
            </span>
          }
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {!session && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              generateAndStore(nearAccountId);
              setRefreshKey((k) => k + 1);
              onKeyChange?.();
            }}
          >
            <PlusCircle className="h-3 w-3 mr-1" />
            Generate Key
          </Button>
        )}
        {session && !boundToCurrentKey && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleLink()}
            disabled={linking}
          >
            {linking ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Link2 className="h-3 w-3 mr-1" />
            )}
            {linking ? "Linking…" : "Link to NEAR"}
          </Button>
        )}
        {session && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              clearSession(nearAccountId);
              setRefreshKey((k) => k + 1);
              onKeyChange?.();
            }}
          >
            Clear Key
          </Button>
        )}
      </div>
    </div>
  );
}
