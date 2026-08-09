import { NearConnector } from "@hot-labs/near-connect";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Wand2,
} from "lucide-react";
import { useCallback, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  NearNostr,
  StandardAdapter,
  detectNostrExtension,
  ExtensionSigner,
  LocalSigner,
  type NostrEvent,
} from "near-nostr-sdk";
import { generateSecretKey } from "nostr-tools/pure";
import { npubEncode, decode as nip19Decode } from "nostr-tools/nip19";
import { useAuthClient, sessionQueryOptions } from "@/app";
import { Badge, Button } from "@/components";
import { Input } from "@/components/ui/input";

type NostrAuthMode = "generated" | "imported" | "extension";

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
];



/** Persisted nostr key state */
function useNostrKey() {
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null);
  const [pubkey, setPubkey] = useState("");
  const [npub, setNpub] = useState("");
  const [mode, setMode] = useState<NostrAuthMode | null>(null);
  const [signer, setSigner] = useState<LocalSigner | ExtensionSigner | null>(null);

  const clear = useCallback(() => {
    localStorage.removeItem("nb-nostr-sk");
    localStorage.removeItem("nb-nostr-mode");
    setSecretKey(null);
    setPubkey("");
    setNpub("");
    setMode(null);
    setSigner(null);
  }, []);

  const generate = useCallback(() => {
    const sk = generateSecretKey();
    const s = new LocalSigner(sk);
    setSecretKey(sk);
    setPubkey(s.pubkey);
    setNpub(npubEncode(s.pubkey));
    setMode("generated");
    setSigner(s);
    localStorage.setItem("nb-nostr-sk", JSON.stringify(Array.from(sk)));
    localStorage.setItem("nb-nostr-mode", "generated");
    toast.success("Key generated");
  }, []);

  const importKey = useCallback((input: string) => {
    try {
      const { type, data } = nip19Decode(input.trim());
      if (type !== "nsec") throw new Error("not an nsec key");
      const sk = data as Uint8Array;
      const s = new LocalSigner(sk);
      setSecretKey(sk);
      setPubkey(s.pubkey);
      setNpub(npubEncode(s.pubkey));
      setMode("imported");
      setSigner(s);
      localStorage.setItem("nb-nostr-sk", JSON.stringify(Array.from(sk)));
      localStorage.setItem("nb-nostr-mode", "imported");
      toast.success("Key imported");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid key");
      return false;
    }
  }, []);

  const detect = useCallback(async () => {
    const ext = detectNostrExtension();
    if (!ext) { toast.error("No extension found"); return false; }
    const s = new ExtensionSigner(ext);
    const pk = await s.getPublicKey();
    setSecretKey(null);
    setPubkey(pk);
    setNpub(npubEncode(pk));
    setMode("extension");
    setSigner(s);
    localStorage.removeItem("nb-nostr-sk");
    localStorage.setItem("nb-nostr-mode", "extension");
    toast.success("Extension connected");
    return true;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("nb-nostr-sk");
    const storedMode = localStorage.getItem("nb-nostr-mode") as NostrAuthMode | null;
    if (stored && storedMode && storedMode !== "extension") {
      try {
        const sk = new Uint8Array(JSON.parse(stored));
        const s = new LocalSigner(sk);
        setSecretKey(sk);
        setPubkey(s.pubkey);
        setNpub(npubEncode(s.pubkey));
        setMode(storedMode);
        setSigner(s);
      } catch { /* corrupt */ }
    }
  }, []);

  return { secretKey, pubkey, npub, mode, signer, generate, importKey, detect, clear };
}

type LinkStep = "idle" | "challenge" | "signing" | "wallet" | "done";

/**
 * Nostr identity linking for nearbuilders.org.
 * Uses SDK client-side (same flow as near-nostr-bindings-web).
 * 5 steps: connect → challenge → sign → wallet tx → verify
 */
export function NostrLink() {
  const { pubkey, npub, mode, signer, generate, importKey, detect, clear } = useNostrKey();
  const [step, setStep] = useState<LinkStep>("idle");
  const [challenge, setChallenge] = useState("");
  const [, setChallengeExpires] = useState(0);
  const [signedEvent, setSignedEvent] = useState<NostrEvent | null>(null);
  const [, setTxHash] = useState("");
  const [importInput, setImportInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const sdkRef = useRef<NearNostr | null>(null);
  const connectorRef = useRef<NearConnector | null>(null);

  // Init near-connect once (same as nostr-testbench)
  useEffect(() => {
    if (connectorRef.current) return;
    const c = new NearConnector({ network: "mainnet" });
    connectorRef.current = c;
  }, []);

  const { data: session } = useQuery(sessionQueryOptions(auth));
  const account = session?.user?.id;
  const [nearAccountId, setNearAccountId] = useState("");
  const hasExtension = detectNostrExtension();

  // Resolve real NEAR account from wallet (session.user.id may be shortened)
  useEffect(() => {
    const c = connectorRef.current;
    if (!c) return;
    c.wallet().then(w => w.getAccounts()).then(accts => {
      if (accts[0]?.accountId) setNearAccountId(accts[0].accountId);
    }).catch(() => {});
  }, []);

  function getSdk(): NearNostr {
    if (!sdkRef.current) {
      const sdk = new NearNostr({ relays: DEFAULT_RELAYS, clientName: "nearbuilders.org" });
      sdk.useAdapter(new StandardAdapter(DEFAULT_RELAYS));
      sdkRef.current = sdk;
    }
    return sdkRef.current;
  }

  // Check existing binding via SDK
  const { data: binding, isLoading: isLoadingBinding } = useQuery({
    queryKey: ["nostr-binding", nearAccountId],
    queryFn: async () => {
      if (!nearAccountId) return null;
      try { return await getSdk().getIdentity(nearAccountId); }
      catch { return null; }
    },
    enabled: !!nearAccountId,
  });

  // Step 2: Generate challenge (SDK local)
  const doChallenge = useCallback(() => {
    if (!nearAccountId) return;
    const sdk = getSdk();
    const { challenge: c, expiresAt } = sdk.createBindingChallenge(nearAccountId);
    setChallenge(c);
    setChallengeExpires(expiresAt);
    setStep("challenge");
  }, [account]);

  // Step 3: Sign challenge → auto-proceed to wallet tx
  // Step 4: Verify + submit to NEAR (defined first — doSign calls it)
  const doTx = useCallback(async (evt?: NostrEvent) => {
    const e = evt ?? signedEvent;
    if (!account || !pubkey || !e) return;
    setStep("wallet");
    try {
      const sdk = getSdk();
      sdk.verifyBindingEvent(e);
      const proof = JSON.stringify({ eventId: e.id });
      const connector = connectorRef.current;
      if (!connector) throw new Error("Wallet not initialized");
      const wallet = await connector.wallet();
      const accts = await wallet.getAccounts();
      const nearId = accts[0]?.accountId ?? account;
      const args = sdk.buildBindingArgs({
        nearAccountId: nearId,
        nostrPubkey: pubkey,
        relay: DEFAULT_RELAYS[0],
        proof,
      });
      if (!accts.length) throw new Error("No wallet connected");

      const outcome = await wallet.signAndSendTransaction({
        receiverId: args.contract,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: args.method,
              args: args.args,
              gas: "100000000000000",
              deposit: "10000000000000000000000",
            },
          },
        ],
      });
      const success = (outcome as any)?.status?.SuccessValue !== undefined;
      setTxHash((outcome as any)?.transaction?.hash ?? (success ? "submitted" : "failed"));
      setStep("done");
      void queryClient.invalidateQueries({ queryKey: ["nostr-binding", nearAccountId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tx failed");
      setStep("challenge");
    }
  }, [account, pubkey, signedEvent, auth, queryClient]);

  // Step 3: Sign challenge → auto-proceed to wallet tx
  const doSign = useCallback(async () => {
    if (!pubkey || !challenge || !signer) return;
    setStep("signing");
    try {
      const sdk = getSdk();
      const template = sdk.buildBindingEventTemplate({ nostrPubkey: pubkey, challenge });
      const event = await signer.signEvent(template);
      setSignedEvent(event);
      // Auto-proceed to wallet tx
      await doTx(event);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign failed");
      setStep("challenge");
    }
  }, [pubkey, challenge, signer, doTx]);

  // Step 5: Re-verify binding
  const doVerify = useCallback(async () => {
    if (!account) return;
    try {
      const id = await getSdk().getIdentity(account);
      void queryClient.invalidateQueries({ queryKey: ["nostr-binding", nearAccountId] });
      if (id) toast.success("Binding verified!");
      else toast.error("No binding found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verify failed");
    }
  }, [account, queryClient]);

  const resetFlow = useCallback(() => {
    setChallenge("");
    setChallengeExpires(0);
    setSignedEvent(null);
    setTxHash("");
    setStep("idle");
  }, []);

  if (!account || isLoadingBinding) return null;

  const isBound = !!binding?.nostrPubkey;

  if (isBound) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Check className="size-4 text-brand-mint-foreground" />
          <span className="text-muted-foreground">Nostr linked</span>
          <Badge variant="success">{mode ?? "extension"}</Badge>
        </div>
        {npub && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3.5 py-2">
            <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
            <code className="min-w-0 truncate text-xs font-mono text-foreground">{npub}</code>
            <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => { void navigator.clipboard.writeText(npub); toast.success("npub copied"); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Not bound — 5-step linking flow ──
  return (
    <div className="space-y-4">
      {/* Step 1: Connect NEAR + pick Nostr key */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">1</span>
          <span>Connect identity</span>
          {pubkey && <Check className="size-3.5 text-brand-mint-foreground" />}
        </div>
        {pubkey ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3.5 py-2">
            <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
            <code className="min-w-0 truncate text-xs font-mono text-foreground">{npub}</code>
            <Badge variant="secondary">{mode}</Badge>
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" onClick={clear} title="Remove key">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={generate}>
              <Wand2 className="size-3.5" /> Generate key
            </Button>
            {hasExtension ? (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => void detect()}>
                <Link2 className="size-3.5" /> Extension
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-2" disabled>
                <Link2 className="size-3.5" /> No extension
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowImport(!showImport)}>
              <Pencil className="size-3.5" /> Import nsec
            </Button>
          </div>
        )}
        {showImport && !pubkey && (
          <div className="flex gap-2">
            <Input type="password" value={importInput} onChange={(e) => setImportInput(e.target.value)}
              placeholder="nsec1..." className="max-w-xs font-mono text-xs"
              onKeyDown={(e) => { if (e.key === "Enter" && importInput.trim()) { const ok = importKey(importInput); if (ok) setImportInput(""); } }} />
            <Button variant="outline" size="sm" disabled={!importInput.trim()}
              onClick={() => { const ok = importKey(importInput); if (ok) setImportInput(""); }}>Import</Button>
          </div>
        )}
      </div>

      {/* Step 2: Generate challenge */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">2</span>
          <span>Challenge</span>
          {!!challenge && <Check className="size-3.5 text-brand-mint-foreground" />}
        </div>
        {!pubkey ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="size-3.5" /> Pick a Nostr key first
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-2" onClick={doChallenge} disabled={!!challenge}>
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

      {/* Step 3: Sign */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">3</span>
          <span>Sign</span>
          {!!signedEvent && <Check className="size-3.5 text-brand-mint-foreground" />}
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void doSign()} disabled={!challenge || !pubkey || !!signedEvent}>
          {step === "signing" ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {step === "signing" ? "Signing..." : "Sign challenge"}
        </Button>
      </div>

      {/* Step 4: Submit to NEAR */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">4</span>
          <span>Submit to NEAR</span>
          {step === "done" && <Check className="size-3.5 text-brand-mint-foreground" />}
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void doTx()}
          disabled={!signedEvent || !account}>
          {step === "wallet" ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {step === "wallet" ? "Confirm in wallet..." : "Sign & send tx"}
        </Button>
      </div>

      {/* Step 5: Verify */}
      {step === "done" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="inline-flex size-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">5</span>
            <span>Verify</span>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void doVerify()}>
            Check binding
          </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={resetFlow}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        </div>
      )}
    </div>
  );
}
