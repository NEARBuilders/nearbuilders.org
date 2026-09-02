import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuthClient } from "@/app";
import { Card } from "@/components";
import {
  buildThreads,
  getBinding,
  listComments,
  loadSession,
  type NearNostrTarget,
  type OrphanPolicy,
  publishComment,
  secretKeyBytes,
} from "@/lib/nostr";
import { CommentItem } from "./comment-item";
import { NostrCommentForm } from "./nostr-comment-form";

export function NostrComments({
  target,
  relays,
  limit = 50,
  orphans = "promote",
}: {
  target: NearNostrTarget;
  relays?: string[];
  limit?: number;
  orphans?: OrphanPolicy;
}) {
  const auth = useAuthClient();
  const nearAccountId = auth.near.getAccountId();
  const session = useMemo(
    () => (nearAccountId ? loadSession(nearAccountId) : null),
    [nearAccountId],
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["nostr-comments", target.type, target.id, refreshKey],
    queryFn: () => listComments({ target, limit, relays }),
    staleTime: 30_000,
  });

  const tree = useMemo(() => buildThreads(comments, { orphans }), [comments, orphans]);

  const accounts = useMemo(
    () => [...new Set(comments.map((c) => c.nearAccountId).filter((a): a is string => !!a))],
    [comments],
  );

  const { data: bindingMap = {} } = useQuery({
    queryKey: ["nostr-bindings", accounts],
    queryFn: async () => {
      const map: Record<string, string | null> = {};
      await Promise.all(
        accounts.map(async (acc) => {
          const binding = await getBinding(acc);
          map[acc] = binding?.nostrPubkey ?? null;
        }),
      );
      return map;
    },
    enabled: accounts.length > 0,
  });

  const handlePublish = async (
    content: string,
    parentEventId?: string,
    rootEventId?: string,
    parentPubkey?: string,
  ) => {
    if (!session || !nearAccountId) return;
    setPublishing(true);
    try {
      await publishComment({
        target,
        content,
        secretKey: secretKeyBytes(session),
        nearAccountId,
        parentEventId,
        rootEventId,
        parentPubkey,
        relays,
      });
      setRefreshKey((k) => k + 1);
      setReplyingTo(null);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
          Comments
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      {session && (
        <NostrCommentForm
          onSubmit={(content) => handlePublish(content)}
          loading={publishing}
          placeholder={`Comment on ${target.type}:${target.id}...`}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          <div className="p-4 border border-border rounded-[10px] bg-card animate-pulse">
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
        </div>
      ) : tree.length === 0 ? (
        <div className="text-muted-foreground text-sm text-center py-8">
          No comments yet. Be the first!
        </div>
      ) : (
        <div className="space-y-3">
          {tree.map((node) => (
            <CommentItem
              key={node.eventId}
              node={node}
              replyingTo={replyingTo}
              publishing={publishing}
              bindingMap={bindingMap}
              onReply={(id) => setReplyingTo(replyingTo === id ? null : id)}
              onSubmitReply={handlePublish}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
