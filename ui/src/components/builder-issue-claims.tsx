import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
      const result = (await apiClient.listIssueClaims({
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
      <section className="mt-6">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Issue claims
        </h3>
        <Skeleton className="h-16 w-full rounded-xl" />
      </section>
    );
  }

  if (claims.length === 0) return null;

  return (
    <section className="mt-6 space-y-4">
      {active.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Active claims ({active.length})
          </h3>
          <ul className="space-y-2">
            {active.map((claim) => (
              <li key={claim.id}>
                <ClaimRow claim={claim} tone="active" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {merged.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Merged contributions ({merged.length})
          </h3>
          <ul className="space-y-2">
            {merged.map((claim) => (
              <li key={claim.id}>
                <ClaimRow claim={claim} tone="merged" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ClaimRow({ claim, tone }: { claim: IssueClaim; tone: "active" | "merged" }) {
  const icon =
    tone === "merged" ? (
      <Check className="h-3 w-3 text-brand-green" />
    ) : claim.status === "submitted" ? (
      <GitPullRequest className="h-3 w-3 text-brand-cyan" />
    ) : null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {icon}
          <span className="font-mono">
            {claim.repoOwner}/{claim.repoName}#{claim.issueNumber}
          </span>
        </div>
        <Link
          to="/issues"
          className={cn(
            "mt-0.5 line-clamp-1 text-sm font-medium hover:underline",
            tone === "merged" ? "text-foreground" : "text-foreground",
          )}
        >
          {claim.issueTitle}
        </Link>
      </div>
      <a
        href={claim.prUrl ?? claim.issueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-brand-cyan hover:underline"
      >
        {claim.prUrl ? "PR" : "Issue"}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
