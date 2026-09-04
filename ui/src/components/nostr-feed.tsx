import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { loadSession, type Signer, secretKeyBytes, signCommentEvent } from "@/lib/nostr";

type NostrFeedProps = {
  target: string;
  targetType?: string;
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

function PubkeyBadge({ pubkey, nearAccountId }: { pubkey: string; nearAccountId?: string | null }) {
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

function CommentRow({
  comment,
}: {
  comment: {
    id: string;
    pubkey: string;
    content: string;
    createdAt: number;
    nearAccountId?: string | null;
    profile?: { name?: string | null; picture?: string | null } | null;
  };
}) {
  const initials = (comment.profile?.name ?? comment.nearAccountId ?? "?")[0].toUpperCase();

  return (
    <div className="flex gap-3 py-3">
      <Avatar className="size-7 shrink-0">
        {comment.profile?.picture ? <AvatarImage src={comment.profile.picture} alt="" /> : null}
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {comment.profile?.name ?? comment.nearAccountId ?? truncate(comment.pubkey, 16)}
          </span>
          <PubkeyBadge pubkey={comment.pubkey} nearAccountId={comment.nearAccountId} />
        </div>
        <p className="text-sm text-foreground/90 break-words">{comment.content}</p>
        <span className="text-[10px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
      </div>
    </div>
  );
}

export function NostrFeed({ target, targetType = "project", requireBound }: NostrFeedProps) {
  const [content, setContent] = useState("");
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();

  const commentsKey = ["nostr-comments", target, targetType, requireBound] as const;

  const { data: commentsData, isLoading } = useQuery({
    queryKey: commentsKey,
    queryFn: () =>
      apiClient.nostr.listComments({
        target,
        targetType,
        adapterType: "standard",
        enrich: true,
        requireBound,
        limit: 50,
      }),
    refetchInterval: 30_000,
  });

  const { data: session } = useQuery(sessionQueryOptions(auth));
  const nearAccountId = session?.user?.id;
  const nostrSession = nearAccountId ? loadSession(nearAccountId) : null;

  const { mutate: postComment, isPending: isPosting } = useMutation({
    mutationFn: async (text: string) => {
      if (!nearAccountId) throw new Error("Not signed in");
      const session = loadSession(nearAccountId);
      if (!session) {
        throw new Error("No Nostr key — set one up in settings first");
      }
      const signer: Signer =
        session.mode === "local"
          ? { mode: "local", secretKey: secretKeyBytes(session) }
          : { mode: "extension" };
      const event = await signCommentEvent({
        content: text,
        target: { type: targetType, id: target },
        nearAccountId,
        signer,
      });
      const result = await apiClient.nostr.createComment({
        event,
        target,
        targetType,
        adapterType: "standard",
      });
      const ok = result.statuses.filter((s) => s.success).length;
      if (ok === 0) throw new Error("All relays rejected the event");
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
  const canPost = Boolean(nearAccountId && nostrSession);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="size-4 text-muted-foreground" />
        <span>Comments</span>
        {comments.length > 0 && <span className="text-muted-foreground">{comments.length}</span>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            !session?.user
              ? "Connect wallet to comment"
              : !canPost
                ? "Set up a Nostr key in settings to comment"
                : "Write a comment..."
          }
          disabled={!canPost || isPosting}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm
            placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring
            disabled:opacity-50 disabled:cursor-not-allowed"
          maxLength={500}
        />
        <Button
          type="submit"
          size="icon"
          variant="outline"
          disabled={!content.trim() || !canPost || isPosting}
          className="shrink-0"
        >
          {isPosting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
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
