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
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Badge, Button } from "@/components";
import { Input } from "@/components/ui/input";
import { useNearAccount } from "@/hooks";
import {
  clearSession,
  connectExtensionAndStore,
  detectNostrExtension,
  generateAndStore,
  importAndStore,
  loadSession,
  type NostrSession,
  nip19Decode,
  npubEncode,
  pollBinding,
  type Signer,
  secretKeyBytes,
  signBindingEvent,
  submitBindingWrite,
} from "@/lib/nostr";

type LinkStep = "idle" | "challenge" | "signing" | "wallet" | "done";

function boundPubkeyHex(bound: string): string {
  if (bound.startsWith("npub1")) {
    try {
      const decoded = nip19Decode(bound);
      if (decoded.type === "npub" && typeof decoded.data === "string") {
        return decoded.data.toLowerCase();
      }
    } catch {
      return bound.toLowerCase();
    }
  }
  return bound.toLowerCase();
}

function sessionMatchesBinding(session: NostrSession, bound: string): boolean {
  return session.pubkey.toLowerCase() === boundPubkeyHex(bound);
}

function SigningKeySetup({
  nearAccountId,
  hasExtension,
  expectedPubkey,
  showImport,
  importInput,
  setShowImport,
  setImportInput,
  onStored,
}: {
  nearAccountId: string;
  hasExtension: boolean;
  expectedPubkey?: string | null;
  showImport: boolean;
  importInput: string;
  setShowImport: (next: boolean) => void;
  setImportInput: (next: string) => void;
  onStored: () => void;
}) {
  const keepSession = (session: NostrSession, requireMatch: boolean) => {
    if (requireMatch && expectedPubkey && !sessionMatchesBinding(session, expectedPubkey)) {
      clearSession(nearAccountId);
      toast.error("This key does not match the linked Nostr identity");
      return;
    }
    onStored();
  };

  const handleImport = () => {
    try {
      keepSession(importAndStore(nearAccountId, importInput), true);
      setImportInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid key");
    }
  };

  return (
    <div className="space-y-2">
      {expectedPubkey ? (
        <p className="text-xs text-muted-foreground">Add a local signing key to comment.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => keepSession(generateAndStore(nearAccountId), false)}
        >
          <Wand2 className="size-3.5" /> Generate key
        </Button>
        {hasExtension ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              void connectExtensionAndStore(nearAccountId).then((session) =>
                keepSession(session, true),
              );
            }}
          >
            Extension
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowImport(!showImport)}
        >
          <Pencil className="size-3.5" /> Import nsec
        </Button>
      </div>
      {showImport ? (
        <div className="flex gap-2">
          <Input
            type="password"
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            placeholder="nsec1..."
            className="max-w-xs font-mono text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && importInput.trim()) handleImport();
            }}
          />
          <Button variant="outline" size="sm" disabled={!importInput.trim()} onClick={handleImport}>
            Import
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Nostr identity linking for nearbuilders.org.
 * Challenge/verify/prepare run against the remote nostr plugin; the KV write
 * goes through the signed-in SIWN wallet. All Nostr signing is client-side.
 */
export function NostrLink() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<LinkStep>("idle");
  const [challenge, setChallenge] = useState("");
  const [importInput, setImportInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [sessionRev, setSessionRev] = useState(0);

  const { data: session } = useQuery(sessionQueryOptions(auth));
  const { accountId: nearAccountId, isLoading: nearAccountLoading } = useNearAccount(
    Boolean(session?.user),
  );
  const nostrSession = useMemo(
    () => (nearAccountId ? loadSession(nearAccountId) : null),
    [nearAccountId, sessionRev],
  );
  const refreshNostrSession = useCallback(() => {
    setSessionRev((n) => n + 1);
  }, []);
  const hasExtension = detectNostrExtension();

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
      const session = loadSession(nearAccountId);
      if (!session) {
        throw new Error("No Nostr key — generate, import, or connect an extension first");
      }
      setStep("signing");
      const signer: Signer =
        session.mode === "local"
          ? { mode: "local", secretKey: secretKeyBytes(session) }
          : { mode: "extension" };
      const event = await signBindingEvent({
        challenge: challengeText,
        nearAccountId,
        signer,
      });
      setStep("wallet");
      const verify = await apiClient.nostr.verifyBinding({ event });
      if (!verify.valid) throw new Error("Binding event failed verification");
      const relays = await apiClient.nostr.listRelays();
      const tx = await apiClient.nostr.prepareBindingWrite({
        nostrPubkey: verify.nostrPubkey,
        relay: relays.relays[0] ?? "",
        proof: verify.proof,
      });
      const ok = await submitBindingWrite(auth, tx, nearAccountId);
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

  if (!session?.user || nearAccountLoading || isLoadingBinding) return null;

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
        {nostrSession ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (!nearAccountId) return;
              clearSession(nearAccountId);
              refreshNostrSession();
              invalidateBinding();
              toast.info("Local key cleared; on-chain binding remains");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear local key
          </Button>
        ) : nearAccountId ? (
          <SigningKeySetup
            nearAccountId={nearAccountId}
            hasExtension={hasExtension}
            expectedPubkey={binding.npub}
            showImport={showImport}
            importInput={importInput}
            setShowImport={setShowImport}
            setImportInput={setImportInput}
            onStored={refreshNostrSession}
          />
        ) : null}
      </div>
    );
  }

  // ── Not bound — 3-step linking flow ──
  return (
    <div className="space-y-4">
      {/* Step 1: Connect NEAR + pick Nostr key */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-3xs text-muted-foreground">
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
                  if (!nearAccountId) return;
                  clearSession(nearAccountId);
                  refreshNostrSession();
                  toast.info("Key removed");
                }}
                title="Remove key"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <SigningKeySetup
            nearAccountId={nearAccountId}
            hasExtension={hasExtension}
            showImport={showImport}
            importInput={importInput}
            setShowImport={setShowImport}
            setImportInput={setImportInput}
            onStored={refreshNostrSession}
          />
        )}
      </div>

      {/* Step 2: Challenge */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-3xs text-muted-foreground">
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
            <div className="text-3xs text-muted-foreground">kind 27235</div>
            <code className="block break-all text-xs font-mono text-foreground">{challenge}</code>
          </div>
        )}
      </div>

      {/* Step 3: Sign + submit */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-3xs text-muted-foreground">
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
