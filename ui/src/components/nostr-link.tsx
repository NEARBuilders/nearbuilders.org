import { NearConnector } from "@hot-labs/near-connect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Badge, Button } from "@/components";
import { Input } from "@/components/ui/input";
import {
  clearSession,
  generateAndStore,
  importAndStore,
  loadSession,
  npubEncode,
  pollBinding,
  secretKeyBytes,
  signBindingEvent,
  submitBindingWrite,
} from "@/lib/nostr";

type LinkStep = "idle" | "challenge" | "signing" | "wallet" | "done";

/**
 * Nostr identity linking for nearbuilders.org.
 * Challenge/verify/prepare run against the remote nostr plugin; the KV write
 * goes through the user's HOT wallet. All Nostr signing is client-side.
 */
export function NostrLink() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<LinkStep>("idle");
  const [challenge, setChallenge] = useState("");
  const [importInput, setImportInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const connectorRef = useRef<NearConnector | null>(null);

  useEffect(() => {
    if (connectorRef.current) return;
    connectorRef.current = new NearConnector({ network: "mainnet" });
  }, []);

  const { data: session } = useQuery(sessionQueryOptions(auth));
  const account = session?.user?.id;
  const [nearAccountId, setNearAccountId] = useState("");

  useEffect(() => {
    const c = connectorRef.current;
    if (!c) return;
    c.wallet()
      .then((w) => w.getAccounts())
      .then((accts) => {
        if (accts[0]?.accountId) setNearAccountId(accts[0].accountId);
      })
      .catch(() => {});
  }, []);

  const nostrSession = nearAccountId ? loadSession(nearAccountId) : null;

  const { data: binding, isLoading: isLoadingBinding } = useQuery({
    queryKey: ["nostr-binding", nearAccountId] as const,
    queryFn: () => {
      if (!nearAccountId) return null;
      return apiClient.nostr.getBinding({ nearAccountId });
    },
    enabled: !!nearAccountId,
  });

  const invalidateBinding = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["nostr-binding"] });
  }, [queryClient]);

  const { mutate: startChallenge, isPending: isChallenging } = useMutation({
    mutationFn: async () => {
      if (!nearAccountId) throw new Error("Connect wallet first");
      const { challenge: c } = await apiClient.nostr.createChallenge({});
      return c;
    },
    onSuccess: (c) => {
      setChallenge(c);
      setStep("challenge");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: doSignAndSubmit, isPending: isSubmitting } = useMutation({
    mutationFn: async (challengeText: string) => {
      if (!nearAccountId) throw new Error("Connect wallet first");
      const local = loadSession(nearAccountId);
      if (local?.mode !== "local" || !local.secretKeyHex) {
        throw new Error("No local Nostr key — generate or import one first");
      }
      setStep("signing");
      const event = signBindingEvent({
        challenge: challengeText,
        nearAccountId,
        secretKey: secretKeyBytes(local),
      });
      setStep("wallet");
      const verify = await apiClient.nostr.verifyBinding({ event });
      if (!verify.valid) throw new Error("Binding event failed verification");
      const relays = await apiClient.nostr.listRelays();
      const connector = connectorRef.current;
      if (!connector) throw new Error("Wallet not initialized");
      const tx = await apiClient.nostr.prepareBindingWrite({
        nostrPubkey: verify.nostrPubkey,
        relay: relays.relays[0] ?? "",
        proof: verify.proof,
      });
      const ok = await submitBindingWrite(connector, tx, nearAccountId);
      if (!ok) throw new Error("Transaction failed on-chain");
      const found = await pollBinding(apiClient, nearAccountId);
      if (!found) {
        toast.info("Binding written; FastNear indexing may take a moment");
      }
    },
    onSuccess: () => {
      setStep("done");
      invalidateBinding();
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setStep(challenge ? "challenge" : "idle");
    },
  });

  const resetFlow = useCallback(() => {
    setChallenge("");
    setStep("idle");
  }, []);

  if (!account || isLoadingBinding) return null;

  const npub = nostrSession ? npubEncode(nostrSession.pubkey) : "";
  const isBound = !!binding?.npub;

  if (isBound) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Check className="size-4 text-brand-mint-foreground" />
          <span className="text-muted-foreground">Nostr linked</span>
          {nostrSession && <Badge variant="success">{nostrSession.mode}</Badge>}
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3.5 py-2">
          <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
          <code className="min-w-0 truncate text-xs font-mono text-foreground">{binding.npub}</code>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(binding.npub);
              toast.success("npub copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        {nostrSession && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              clearSession(nearAccountId);
              invalidateBinding();
              toast.info("Local key cleared; on-chain binding remains");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear local key
          </Button>
        )}
      </div>
    );
  }

  // ── Not bound — 3-step linking flow ──
  return (
    <div className="space-y-4">
      {/* Step 1: Connect NEAR + pick Nostr key */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">
            1
          </span>
          <span>Connect identity</span>
          {nostrSession && <Check className="size-3.5 text-brand-mint-foreground" />}
        </div>
        {!nearAccountId ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="size-3.5" /> Connect your wallet first
          </div>
        ) : nostrSession ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3.5 py-2">
            <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
            <code className="min-w-0 truncate text-xs font-mono text-foreground">{npub}</code>
            <Badge variant="secondary">{nostrSession.mode}</Badge>
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  clearSession(nearAccountId);
                  toast.info("Key removed");
                }}
                title="Remove key"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => generateAndStore(nearAccountId)}
            >
              <Wand2 className="size-3.5" /> Generate key
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowImport(!showImport)}
            >
              <Pencil className="size-3.5" /> Import nsec
            </Button>
          </div>
        )}
        {showImport && !nostrSession && (
          <div className="flex gap-2">
            <Input
              type="password"
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="nsec1..."
              className="max-w-xs font-mono text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && importInput.trim()) {
                  try {
                    importAndStore(nearAccountId, importInput);
                    setImportInput("");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Invalid key");
                  }
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!importInput.trim()}
              onClick={() => {
                try {
                  importAndStore(nearAccountId, importInput);
                  setImportInput("");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Invalid key");
                }
              }}
            >
              Import
            </Button>
          </div>
        )}
      </div>

      {/* Step 2: Challenge */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">
            2
          </span>
          <span>Challenge</span>
          {!!challenge && <Check className="size-3.5 text-brand-mint-foreground" />}
        </div>
        {!nostrSession ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="size-3.5" /> Pick a Nostr key first
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => startChallenge()}
            disabled={!!challenge || isChallenging}
          >
            {isChallenging ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {challenge ? "Challenge ready" : "Generate challenge"}
          </Button>
        )}
        {challenge && (
          <div className="rounded-md border border-border bg-muted px-3.5 py-2 space-y-1">
            <div className="text-[10px] text-muted-foreground">kind 27235</div>
            <code className="block break-all text-xs font-mono text-foreground">{challenge}</code>
          </div>
        )}
      </div>

      {/* Step 3: Sign + submit */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">
            3
          </span>
          <span>Sign &amp; submit</span>
          {step === "done" && <Check className="size-3.5 text-brand-mint-foreground" />}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => doSignAndSubmit(challenge)}
          disabled={!challenge || !nostrSession || isSubmitting}
        >
          {step === "signing" || step === "wallet" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : null}
          {step === "wallet"
            ? "Confirm in wallet..."
            : step === "signing"
              ? "Signing..."
              : "Sign challenge & submit"}
        </Button>
        {step === "done" && (
          <Button variant="ghost" size="sm" className="gap-2" onClick={resetFlow}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
