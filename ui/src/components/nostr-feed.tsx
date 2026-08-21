import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send } from "lucide-react";
import {
  detectNostrExtension,
  ExtensionSigner,
  LocalSigner,
  type NostrEvent,
} from "near-nostr-sdk";
import { type FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { useApiClient, type ApiClient, sessionQueryOptions, useAuthClient } from "@/app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";


// Types inferred from the generated apiClient contract — single source of truth
type NostrComment = Awaited<
  ReturnType<ApiClient["listNostrComments"]>
>["data"][number];

type NostrFeedProps = {
  target: string;
  targetType?: string;
  adapterType?: "standard" | "buzz";
  requireBound?: boolean;
};

function timeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000) - ts;
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}...`;
}

function PubkeyBadge({
  pubkey,
  nearAccountId,
}: {
  pubkey: string;
  nearAccountId?: string;
}) {
  const display = nearAccountId ?? truncate(pubkey, 12);
  return (
    <span
      className="text-xs font-mono text-muted-foreground"
      title={nearAccountId ? pubkey : undefined}
    >
      {display}
    </span>
  );
}

function CommentRow({ comment }: { comment: NostrComment }) {
  const initials = (
    comment.profile?.name ?? comment.nearAccountId ?? "?"
  )[0].toUpperCase();

  return (
    <div className="flex gap-3 py-3">
      <Avatar className="size-7 shrink-0">
        {comment.profile?.picture ? (
          <AvatarImage src={comment.profile.picture} alt="" />
        ) : null}
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {comment.profile?.name ??
              comment.nearAccountId ??
              truncate(comment.pubkey, 16)}
          </span>
          <PubkeyBadge
            pubkey={comment.pubkey}
            nearAccountId={comment.nearAccountId ?? undefined}
          />
        </div>
        <p className="text-sm text-foreground/90 break-words">
          {comment.content}
        </p>
        <span className="text-[10px] text-muted-foreground">
          {timeAgo(comment.createdAt)}
        </span>
      </div>
    </div>
  );
}

/** SHA-256 hash of a string → 64-char hex for relay #e tag indexing. */
async function hashHex(id: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Cache the target hex hash so we don't recompute on every render
let targetHexCache: Record<string, Promise<string>> = {};

function getTargetHex(target: string): Promise<string> {
  if (target.length === 64 && /^[0-9a-f]+$/.test(target)) return Promise.resolve(target);
  if (!targetHexCache[target]) targetHexCache[target] = hashHex(target);
  return targetHexCache[target];
}

// Helper to build the standard tags with hashed #e
async function buildStandardTags(target: string, targetType: string, pubkey: string, nearAccountId: string, eHex: string): Promise<string[][]> {
  const nearPubHex = await getTargetHex(`_near_account:${nearAccountId}`);
  return [
    ["e", eHex, "", "root"],
    ["t", target],
    ["t", targetType],
    ["p", pubkey],
    ["p", nearPubHex],
    ["near_target", target],
    ["near_account", nearAccountId],
    ["client", "nearbuilders.org"],
  ];
}

export function NostrFeed({
  target,
  targetType = "project",
  adapterType = "standard",
  requireBound,
}: NostrFeedProps) {
  const [content, setContent] = useState("");
  const auth = useAuthClient();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const { data: commentsData, isLoading } = useQuery({
    queryKey: ["nostr-comments", target, adapterType, requireBound],
    queryFn: () =>
      apiClient.listNostrComments({
        target,
        targetType,
        adapterType,
        requireBound,
        enrich: true,
      }),
    refetchInterval: 30_000,
  });

  const { data: session } = useQuery(sessionQueryOptions(auth));
  const nearAccountId = session?.user?.id;
  const hasNostrKey = !!localStorage.getItem("nb-nostr-mode");

  const { mutate: postComment, isPending: isPosting } = useMutation({
    mutationFn: async (text: string) => {
      console.log("[NOSTR-FEED] postComment started", { text, nearAccountId, hasNostrKey });
      if (!nearAccountId) throw new Error("Not signed in");

      // Get signer from localStorage (same as nostr-link)
      const storedMode = localStorage.getItem("nb-nostr-mode");
      const storedSk = localStorage.getItem("nb-nostr-sk");
      let signer: ExtensionSigner | LocalSigner;
      let pubkey: string;

      if (storedMode === "extension") {
        const ext = detectNostrExtension();
        if (!ext) throw new Error("No Nostr extension found");
        signer = new ExtensionSigner(ext);
        pubkey = await signer.getPublicKey();
      } else if (storedSk) {
        const sk = new Uint8Array(JSON.parse(storedSk));
        signer = new LocalSigner(sk);
        pubkey = signer.pubkey;
      } else {
        const ext = detectNostrExtension();
        if (!ext) throw new Error("No Nostr key — generate one in Nostr settings first");
        signer = new ExtensionSigner(ext);
        pubkey = await signer.getPublicKey();
      }

      // Build + sign event locally
      console.log("[NOSTR-FEED] getting signer...");
      const eHex = await getTargetHex(target);
      console.log("[NOSTR-FEED] targetHex:", eHex);
      const template = {
        kind: 1 as const,
        created_at: Math.floor(Date.now() / 1000),
        tags: await buildStandardTags(target, targetType, pubkey, nearAccountId, eHex),
        content: text,
      };
      const signedEvent: NostrEvent = await signer.signEvent(template);
      console.log("[NOSTR-FEED] signedEvent:", signedEvent.id?.slice(0, 12));

      // Publish via API — server-side plugin publishes to relays
      // (CSP blocks direct wss:// from browser; Firefox doesn't allow wss under https:)
      const result = await apiClient.createNostrComment({
        event: signedEvent,
        target,
        targetType,
        adapterType,
      });
      const statuses = result.statuses ?? [];
      const okCount = statuses.filter((s: { success: boolean }) => s.success).length;
      if (okCount === 0) {
        throw new Error(`All relays rejected the event`);
      }
    },
    onSuccess: () => {
      setContent("");
      void queryClient.invalidateQueries({ queryKey: ["nostr-comments", target] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = content.trim();
      if (!text || isPosting) return;
      postComment(text);
    },
    [content, isPosting, postComment],
  );

  const comments = commentsData?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="size-4 text-muted-foreground" />
        <span>Comments</span>
        {comments.length > 0 && (
          <span className="text-muted-foreground">{comments.length}</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            !session?.user
              ? "Connect wallet to comment"
              : !hasNostrKey
                ? "Set up a Nostr key in settings to comment"
                : "Write a comment..."
          }
          disabled={!session?.user || !hasNostrKey || isPosting}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm
            placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring
            disabled:opacity-50 disabled:cursor-not-allowed"
          maxLength={500}
        />
        <Button
          type="submit"
          size="icon"
          variant="outline"
          disabled={
            !content.trim() || !session?.user || !hasNostrKey || isPosting
          }
          className="shrink-0"
        >
          {isPosting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>

      <ScrollArea className="max-h-[400px]">
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="size-7 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-2 w-12 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No comments yet. Be the first!
          </div>
        ) : (
          <div className="divide-y divide-border">
            {comments.map((c) => (
              <CommentRow key={c.id} comment={c} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
