import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, GitPullRequest } from "lucide-react";
import { useApiClient } from "@/app";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface IssueClaim {
  id: string;
  repoOwner: string;
  repoName: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  nearAccount: string;
  claimedAt: string;
  expiresAt: string;
  releasedAt: string | null;
  prUrl: string | null;
  status: "active" | "submitted" | "merged" | "released" | "expired";
}

export function BuilderIssueClaims({ nearAccount }: { nearAccount: string }) {
  const apiClient = useApiClient();
  const query = useQuery({
    queryKey: ["issue-claims", nearAccount],
    queryFn: async () => {
      const result = (await apiClient.issues.listIssueClaims({
        nearAccount,
        limit: 50,
      })) as { data: IssueClaim[] };
      return result.data;
    },
    staleTime: 60_000,
  });

  const claims = query.data ?? [];
  const active = claims.filter((c) => c.status === "active" || c.status === "submitted");
  const merged = claims.filter((c) => c.status === "merged");

  if (query.isLoading) {
    return (
      <section className="mt-8">
        <h3 className="mb-3 text-sm font-bold text-foreground">Issue claims</h3>
        <Skeleton className="h-16 w-full rounded-xl" />
      </section>
    );
  }

  if (claims.length === 0) return null;

  return (
    <section className="mt-8 space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
            Active claims
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {active.length}
            </span>
          </h3>
          <div className="flex flex-col overflow-hidden rounded-xl border border-border">
            {active.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} tone="active" />
            ))}
          </div>
        </div>
      )}
      {merged.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
            Merged contributions
            <span className="rounded-full bg-brand-accent-light px-2 py-0.5 text-[11px] font-semibold text-brand-accent">
              {merged.length}
            </span>
          </h3>
          <div className="flex flex-col overflow-hidden rounded-xl border border-border">
            {merged.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} tone="merged" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ClaimRow({ claim, tone }: { claim: IssueClaim; tone: "active" | "merged" }) {
  const StatusIcon =
    tone === "merged" ? Check : claim.status === "submitted" ? GitPullRequest : null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {StatusIcon && (
            <span
              className={cn(
                "inline-flex size-4 items-center justify-center rounded-full",
                tone === "merged"
                  ? "bg-brand-accent-light text-brand-accent"
                  : "bg-brand-accent-light text-brand-accent",
              )}
            >
              <StatusIcon className="size-2.5" />
            </span>
          )}
          <span className="font-mono">
            {claim.repoOwner}/{claim.repoName}#{claim.issueNumber}
          </span>
        </div>
        <a
          href={claim.issueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 line-clamp-1 block text-sm font-semibold text-foreground hover:text-brand-accent hover:underline"
        >
          {claim.issueTitle}
        </a>
      </div>
      {claim.prUrl && (
        <a
          href={claim.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-brand-accent hover:text-brand-accent"
        >
          PR
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
