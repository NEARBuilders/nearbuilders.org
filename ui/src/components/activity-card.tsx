import { CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMemo } from "react";
import { CatalogClaimActivity } from "@/components/catalog-claim-activity";
import { NearProfile } from "@/components/near-profile";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VoteButton } from "@/components/ui/vote-button";
import { readCatalogClaimActivityPayload } from "@/lib/catalog-activity";
import { type ActivityEvent, readActivityPayload } from "@/lib/queries/activity";
import { formatRelativeTime } from "@/lib/queries/notifications";
import { cn } from "@/lib/utils";

const SOURCE_BADGE_CLASS: Record<string, string> = {
  manual: "border-brand-green/30 bg-brand-green/10 text-foreground",
  nearcatalog: "border-brand-cyan/30 bg-brand-cyan/10 text-foreground",
  github: "border-brand-accent/30 bg-brand-accent-light text-foreground",
};

function SourceBadge({ source }: { source: string }) {
  const key = source.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
        SOURCE_BADGE_CLASS[key] ?? "border-border bg-muted text-foreground",
      )}
    >
      {source}
    </Badge>
  );
}

export function ActivityCard({
  event,
  count,
  hasUpvote,
  isUpvoting,
  isDownvoting,
  onUpvote,
  onDownvote,
}: {
  event: ActivityEvent;
  count: number;
  hasUpvote: boolean;
  isUpvoting: boolean;
  isDownvoting: boolean;
  onUpvote: () => void;
  onDownvote: () => void;
}) {
  const payload = useMemo(() => readActivityPayload(event.payload), [event.payload]);
  const catalogClaim = useMemo(
    () =>
      event.source === "nearcatalog" && event.type === "claim"
        ? readCatalogClaimActivityPayload(event.payload)
        : null,
    [event.payload, event.source, event.type],
  );

  return (
    <div className="bg-card border border-border rounded-lg px-5 py-4 sm:px-6 sm:py-5 flex gap-4 hover:shadow-lg transition-shadow duration-200">
      <div className="flex flex-col items-center shrink-0 gap-0.5 pt-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <VoteButton
              icon={<ThumbsUp size={16} strokeWidth={2.25} />}
              onClick={onUpvote}
              label="Endorse"
              disabled={isUpvoting}
              active={hasUpvote}
              activeColor="text-brand-accent"
              size="compact"
            />
          </TooltipTrigger>
          <TooltipContent>Endorse this contribution</TooltipContent>
        </Tooltip>
        <span className="min-w-[24px] text-center text-xs font-bold leading-none text-foreground tabular-nums">
          {count}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <VoteButton
              icon={<ThumbsDown size={16} strokeWidth={2.25} />}
              onClick={onDownvote}
              label="Remove endorsement"
              disabled={isDownvoting}
              active={false}
              activeColor="text-destructive"
              size="compact"
            />
          </TooltipTrigger>
          <TooltipContent>Remove your endorsement</TooltipContent>
        </Tooltip>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source={event.source} />
          <Badge
            variant="secondary"
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
          >
            {event.type}
          </Badge>
          {event.verified && (
            <Badge
              variant="success"
              className="gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            >
              <CheckCircle2 size={11} />
              Verified
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>

        <div className="mt-2">
          <NearProfile accountId={event.actor} variant="badge" className="w-auto" />
        </div>

        {catalogClaim ? (
          <CatalogClaimActivity payload={catalogClaim} />
        ) : (
          <>
            {payload.title && (
              <h3 className="mt-2 text-base font-semibold text-foreground leading-snug">
                {payload.title}
              </h3>
            )}
            <div className="mt-1 flex gap-3">
              {payload.description && (
                <p className="text-sm text-muted-foreground line-clamp-3 flex-1 min-w-0">
                  {payload.description}
                </p>
              )}
              {payload.mediaUrl && (
                <img
                  src={payload.mediaUrl}
                  alt={payload.title ?? "Activity media"}
                  className="size-16 rounded-md object-cover border border-border shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
            {payload.tags && payload.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {payload.tags.slice(0, 6).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="rounded-full px-1.5 py-0 text-[10px] font-medium"
                  >
                    {tag}
                  </Badge>
                ))}
                {payload.tags.length > 6 && (
                  <Badge
                    variant="secondary"
                    className="rounded-full px-1.5 py-0 text-[10px] font-medium"
                  >
                    +{payload.tags.length - 6}
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ActivityCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg px-5 py-4 sm:px-6 sm:py-5 flex gap-4">
      <div className="flex flex-col items-center gap-1.5 pt-0.5">
        <Skeleton className="size-5" />
        <Skeleton className="h-2.5 w-4" />
        <Skeleton className="size-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}
