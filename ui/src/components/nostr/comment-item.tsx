import { BadgeCheck, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ThreadNode } from "@/lib/nostr";
import { NostrCommentForm } from "./nostr-comment-form";

export function CommentItem({
  node,
  replyingTo,
  publishing,
  bindingMap,
  onReply,
  onSubmitReply,
}: {
  node: ThreadNode;
  replyingTo: string | null;
  publishing: boolean;
  bindingMap: Record<string, string | null>;
  onReply: (eventId: string) => void;
  onSubmitReply: (
    content: string,
    parentEventId: string,
    rootEventId?: string,
    parentPubkey?: string,
  ) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const replyCount = node.children.length;
  const isReplying = replyingTo === node.eventId;
  const verified = !!node.nearAccountId && bindingMap[node.nearAccountId] === node.pubkey;

  const displayName = node.profile?.name ?? (verified ? node.nearAccountId : undefined);

  return (
    <div className="space-y-2">
      <div className="p-4 border border-border rounded-[10px] space-y-2 bg-card">
        <div className="flex items-center gap-2">
          <Avatar className="w-6 h-6">
            <AvatarImage src={node.profile?.picture} />
            <AvatarFallback className="text-[10px]">
              {(displayName ?? node.pubkey).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground">
            {displayName ?? `${node.pubkey.slice(0, 12)}...`}
          </span>
          {node.nearAccountId && verified && (
            <span className="flex items-center gap-1 text-[11px] text-green-600 font-mono">
              <BadgeCheck className="h-3 w-3" />
              {node.nearAccountId}
            </span>
          )}
          {node.nearAccountId && !verified && (
            <span className="text-[11px] text-muted-foreground font-mono">
              claimed {node.nearAccountId}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto">
            {new Date(node.createdAt * 1000).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{node.content}</p>
        <div className="flex items-center gap-3 pt-1">
          {replyCount > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => onReply(node.eventId)}>
            Reply
          </Button>
        </div>
        {isReplying && (
          <NostrCommentForm
            onSubmit={(content) =>
              onSubmitReply(content, node.eventId, node.rootId ?? node.eventId, node.pubkey)
            }
            loading={publishing}
            placeholder="Write a reply..."
            autoFocus
            submitLabel="Reply"
          />
        )}
      </div>
      {!collapsed && node.children.length > 0 && (
        <div className="ml-6 space-y-2 border-l border-border pl-4">
          {node.children.map((child) => (
            <CommentItem
              key={child.eventId}
              node={child}
              replyingTo={replyingTo}
              publishing={publishing}
              bindingMap={bindingMap}
              onReply={onReply}
              onSubmitReply={onSubmitReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}
