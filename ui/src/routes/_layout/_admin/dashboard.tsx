import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Loader2, MapPin, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { Profile } from "better-near-auth";
import { useApiClient, useAuthClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_layout/_admin/dashboard")({
  head: () => ({
    meta: [{ title: "Admin Dashboard | NEAR Builders" }],
  }),
  component: AdminDashboard,
});

type BuilderStatus = "pending" | "approved" | "rejected";

interface Builder {
  id: string;
  nearAccount: string;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
  status: BuilderStatus;
  rejectionReason: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;

function AdminDashboard() {
  const [tab, setTab] = useState<"pending" | "all">("pending");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-foreground mb-1">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Review and manage builder applications.</p>
      </div>

      <div className="flex gap-1 mb-6">
        {(["pending", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-8 px-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 border capitalize ${
              tab === t
                ? "border-brand-accent bg-brand-accent-light text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "pending" ? <PendingBuildersQueue /> : <AllBuildersQueue />}
    </div>
  );
}

function PendingBuildersQueue() {
  const apiClient = useApiClient();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allBuilders, setAllBuilders] = useState<Builder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const initialized = useRef(false);

  const loadPage = useCallback(
    async (nextCursor?: string) => {
      try {
        const result = await apiClient.builders.listPendingBuilders({
          limit: PAGE_SIZE,
          cursor: nextCursor,
        });
        setAllBuilders((prev) => (nextCursor ? [...prev, ...result.data] : result.data));
        setHasMore(result.meta.hasMore);
        setCursor(result.meta.nextCursor ?? undefined);
      } finally {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    },
    [apiClient],
  );

  useQuery({
    queryKey: ["admin-pending-builders"],
    queryFn: async () => {
      if (!initialized.current) {
        initialized.current = true;
        await loadPage(undefined);
      }
      return null;
    },
    staleTime: 0,
  });

  const onBuilderActioned = (nearAccount: string) => {
    setAllBuilders((prev) => prev.filter((b) => b.nearAccount !== nearAccount));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <BuilderReviewCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (allBuilders.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 py-16 text-center">
        <div className="text-3xl mb-3">✅</div>
        <p className="text-sm font-semibold text-foreground">No pending applications</p>
        <p className="text-xs text-muted-foreground mt-1">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {allBuilders.length} application{allBuilders.length !== 1 ? "s" : ""} pending review
      </p>
      {allBuilders.map((b) => (
        <BuilderReviewCard key={b.id} builder={b} onActioned={onBuilderActioned} />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={isFetchingMore}
            onClick={() => {
              setIsFetchingMore(true);
              loadPage(cursor);
            }}
          >
            {isFetchingMore ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ChevronDown size={14} />
            )}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function AllBuildersQueue() {
  const apiClient = useApiClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-builders"],
    queryFn: () => apiClient.builders.listBuilders({ limit: PAGE_SIZE }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <BuilderReviewCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const builders = data?.data ?? [];

  if (builders.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 py-16 text-center">
        <p className="text-sm text-muted-foreground">No approved builders yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {builders.map((b) => (
        <BuilderReviewCard key={b.id} builder={b} onActioned={() => {}} showStatus />
      ))}
    </div>
  );
}

function BuilderReviewCard({
  builder,
  onActioned,
  showStatus = false,
}: {
  builder: Builder;
  onActioned: (nearAccount: string) => void;
  showStatus?: boolean;
}) {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: profile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["near-profile", builder.nearAccount],
    queryFn: async () => {
      const res = await auth.near.getProfile(builder.nearAccount);
      return res.data || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const displayName = builder.name || profile?.name || builder.nearAccount;
  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);

  const approveMutation = useMutation({
    mutationFn: () => apiClient.builders.approveBuilder({ nearAccount: builder.nearAccount }),
    onSuccess: () => {
      toast.success(`${displayName} approved`);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-builders"] });
      queryClient.invalidateQueries({ queryKey: ["builders", "list"] });
      onActioned(builder.nearAccount);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiClient.builders.rejectBuilder({
        nearAccount: builder.nearAccount,
        reason: rejectReason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`${displayName} rejected`);
      setShowRejectForm(false);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-builders"] });
      onActioned(builder.nearAccount);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to reject"),
  });

  const isPending = builder.status === "pending";

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex gap-4">
      <div className="size-12 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center">
        {profileLoading ? (
          <Skeleton className="size-12 rounded-full" />
        ) : avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="size-12 object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span className="text-sm font-black text-muted-foreground">
            {getInitials(displayName)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {profileLoading ? (
                <Skeleton className="h-5 w-28" />
              ) : (
                <span className="font-bold text-foreground">{displayName}</span>
              )}
              {showStatus && <StatusPill status={builder.status} />}
            </div>
            <div className="text-xs font-mono text-brand-cyan mt-0.5">{builder.nearAccount}</div>
            {builder.location && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin size={10} />
                {builder.location}
              </div>
            )}
          </div>

          {isPending && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="bg-brand-green hover:bg-brand-green/90 text-black"
              >
                {approveMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRejectForm((v) => !v)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <X size={13} />
                Reject
              </Button>
            </div>
          )}
        </div>

        {builder.bio && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">
            {builder.bio}
          </p>
        )}

        {builder.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {builder.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {showRejectForm && isPending && (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
                Confirm rejection
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground/50 mt-2">
          Applied {new Date(builder.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function BuilderReviewCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex gap-4">
      <Skeleton className="size-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: BuilderStatus }) {
  const classes: Record<BuilderStatus, string> = {
    pending: "bg-secondary border-border text-muted-foreground",
    approved: "bg-brand-accent-light border-brand-accent text-foreground",
    rejected: "bg-destructive/10 border-destructive/30 text-destructive",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${classes[status]}`}
    >
      {status}
    </span>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
