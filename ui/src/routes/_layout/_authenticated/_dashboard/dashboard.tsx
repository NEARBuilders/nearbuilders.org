import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { Profile } from "better-near-auth";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  Hammer,
  Loader2,
  MapPin,
  Plus,
  Settings,
  ThumbsUp,
  Wallet,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { type SessionData, sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { BuilderOnboardingChecklist } from "@/components/builder-onboarding-checklist";
import { NearProfile } from "@/components/near-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { nearProfileOptions } from "@/lib/queries/builders";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/dashboard")({
  head: () => ({
    meta: [
      { title: "Builder Dashboard | NEAR Builders" },
      {
        name: "description",
        content: "Manage builder projects, ideas, skills, profile status, proposals, and votes.",
      },
    ],
  }),
  component: Dashboard,
});

const RECENT_PROJECTS_LIMIT = 5;

function Dashboard() {
  const auth = useAuthClient();
  const apiClient = useApiClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const user = session?.user;

  const {
    data: projectsData,
    isLoading: projectsLoading,
    isError: projectsError,
  } = useQuery({
    queryKey: ["projects-personal", nearAccountId],
    queryFn: () =>
      apiClient.listProjects({
        limit: RECENT_PROJECTS_LIMIT,
        ownerId: nearAccountId ?? undefined,
      }),
    enabled: !!nearAccountId,
  });

  const { data: builderResult, isLoading: builderLoading } = useQuery({
    queryKey: ["my-builder-profile", user?.id, nearAccountId],
    queryFn: () => apiClient.getMyBuilderProfile({}),
    enabled: Boolean(user && !user.isAnonymous),
  });

  const { data: nearProfile, isLoading: nearProfileLoading } = useQuery<Profile | null>(
    nearProfileOptions(auth, nearAccountId ?? ""),
  );

  const { data: firstIdeaResult, isLoading: firstIdeaLoading } = useQuery({
    queryKey: ["builder-first-idea", nearAccountId],
    queryFn: () =>
      apiClient.listProjects({
        ownerId: nearAccountId ?? undefined,
        kind: "idea",
        limit: 1,
      }),
    enabled: Boolean(nearAccountId),
  });

  const { data: builderProposalResult, isLoading: builderProposalLoading } = useQuery({
    queryKey: ["builder-proposals", nearAccountId],
    queryFn: () =>
      apiClient.getProposals({
        pluginId: "builders",
        entityId: nearAccountId!,
        limit: 1,
      }),
    enabled: Boolean(nearAccountId),
  });

  const builderProfile = builderResult?.data ?? null;
  const builderProposal = builderProposalResult?.data[0] ?? null;

  const projects = projectsData?.data ?? [];
  const projectCount = projectsData?.meta.total ?? projects.length;
  const projectIds = projects.map((project) => project.id);

  const { data: projectVoteCounts } = useQuery({
    queryKey: ["dashboard-project-upvote-counts", projectIds],
    queryFn: () => apiClient.getUpvoteCounts({ entityIds: projectIds }),
    enabled: projectIds.length > 0,
  });

  const auditLogQuery = useInfiniteQuery({
    queryKey: ["builder-audit-log", nearAccountId],
    queryFn: ({ pageParam }) =>
      apiClient.getAuditLog({
        pluginId: "builders",
        entityId: nearAccountId!,
        limit: 20,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.meta.nextCursor ?? undefined,
    enabled: Boolean(nearAccountId && (builderProfile || builderProposal)),
  });

  const auditEntries = auditLogQuery.data?.pages.flatMap((page) => page.data) ?? [];

  if (!user) {
    return (
      <DashboardPageFrame>
        <DashboardHeader />
        <div className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-8 w-48" />
        </div>
      </DashboardPageFrame>
    );
  }

  if (!nearAccountId) {
    return (
      <DashboardPageFrame>
        <DashboardHeader />
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col items-center justify-center gap-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Connect your NEAR wallet</h2>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Link a NEAR account to manage your builder dashboard, projects, ideas, and skills.
              </p>
            </div>
            <Button onClick={() => auth.signIn.near()} className="rounded-full">
              Connect NEAR wallet
            </Button>
          </div>
        </div>
      </DashboardPageFrame>
    );
  }
  return (
    <DashboardPageFrame>
      <DashboardHeader
        nearAccountId={nearAccountId}
        nearProfile={nearProfile}
        showPublicProfile={Boolean(builderProfile)}
      />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
        <div className="min-w-0">
          <NearProfile accountId={nearAccountId} variant="card" className="h-full" />
        </div>

        <div className="min-w-0 space-y-3 lg:sticky lg:top-24 lg:self-start">
          <BuilderOnboardingChecklist
            accountId={nearAccountId}
            nearProfile={nearProfile}
            builderProfile={builderProfile}
            hasFirstIdea={(firstIdeaResult?.data.length ?? 0) > 0}
            isLoading={
              nearProfileLoading || builderLoading || builderProposalLoading || firstIdeaLoading
            }
          />
          <BuilderProfileCard
            builderProfile={builderProfile}
            builderProposal={builderProposal}
            isLoading={builderLoading || builderProposalLoading}
            nearAccountId={nearAccountId}
            apiClient={apiClient}
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Workspace
              </p>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Projects and ideas
                </h2>
                {projectsLoading ? (
                  <Skeleton className="h-5 w-8 rounded-full" />
                ) : (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                    {projectCount}
                  </span>
                )}
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Keep active projects, early ideas, repositories, and live apps visible from one
                workspace.
              </p>
            </div>

            <Link
              to="/projects"
              search={{ personal: true }}
              className="group inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {projectsError ? (
            <DashboardErrorCard message="Projects and ideas could not be loaded." />
          ) : projectsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-5 py-10 text-center sm:min-h-[236px]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">
                    Start your first project or idea
                  </h3>
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                    Add a project, idea, repository, or live app so collaborators can understand
                    what you are building.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/projects/new" search={{ tab: "write" }}>
                    Create project or idea
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  voteCount={projectVoteCounts?.[project.id]?.totalCount}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <ReviewActivityCard
            builderProposal={builderProposal}
            auditEntries={auditEntries}
            hasMore={auditLogQuery.hasNextPage}
            isLoading={builderProposalLoading || auditLogQuery.isLoading}
            isLoadingMore={auditLogQuery.isFetchingNextPage}
            onLoadMore={() => auditLogQuery.fetchNextPage()}
          />
        </aside>
      </section>
    </DashboardPageFrame>
  );
}

interface BuilderProfileData {
  nearAccount: string;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
  links: Record<string, string> | null;
}

type ProposalStatus = "pending" | "approved" | "rejected" | "removed";

interface BuilderProposalData {
  id: string;
  pluginId: string;
  entityId: string;
  payload: unknown;
  reviewStatus: ProposalStatus;
  rejectionReason: string | null;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AuditEntryData {
  id: string;
  action: string;
  actorLabel: string | null;
  createdAt: string;
}

function readProposalPayload(payload: unknown) {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const record = data as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : null,
    bio: typeof record.bio === "string" ? record.bio : null,
    skills: Array.isArray(record.skills)
      ? record.skills.filter((item): item is string => typeof item === "string")
      : [],
    location: typeof record.location === "string" ? record.location : null,
  };
}

function formatAuditAction(action: string) {
  return action
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDashboardDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function DashboardPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-full bg-muted/30 px-4 py-6 pb-10 sm:px-6 sm:py-8 sm:pb-12 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">{children}</div>
    </div>
  );
}

function DashboardErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex min-h-[116px] items-center gap-3 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Unable to load dashboard data</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewActivityCard({
  builderProposal,
  auditEntries,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
}: {
  builderProposal: BuilderProposalData | null;
  auditEntries: AuditEntryData[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Review activity
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : builderProposal ? (
          <>
            <div className="rounded-xl border border-border bg-muted/35 p-3">
              <p className="text-sm font-semibold text-foreground">Builder proposal</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {builderProposal.submissionCount} nomination
                {builderProposal.submissionCount !== 1 ? "s" : ""} submitted. Last updated{" "}
                {formatDashboardDate(builderProposal.updatedAt)}.
              </p>
            </div>

            {auditEntries.length > 0 ? (
              <div className="space-y-2">
                {auditEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-cyan" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {formatAuditAction(entry.action)}
                      </p>
                      <p className="text-muted-foreground">
                        {entry.actorLabel || "System"} - {formatDashboardDate(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-1 w-full justify-between px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading activity..." : "View more activity"}
                    {isLoadingMore ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                No audit entries are available for this builder proposal yet.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Register as a builder to start review history for proposals and nominations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BuilderProfileCard({
  builderProfile,
  builderProposal,
  isLoading,
  nearAccountId,
  apiClient,
}: {
  builderProfile: BuilderProfileData | null;
  builderProposal: BuilderProposalData | null;
  isLoading: boolean;
  nearAccountId: string;
  apiClient: ReturnType<typeof useApiClient>;
}) {
  const queryClient = useQueryClient();
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    bio: "",
    skillsRaw: "",
    location: "",
  });
  const profileCardClassName = "overflow-hidden rounded-2xl border-brand-accent-border shadow-sm";

  const registerMutation = useMutation({
    mutationFn: () =>
      apiClient.propose({
        pluginId: "builders",
        entityId: nearAccountId,
        payload: {
          name: form.name.trim() || undefined,
          bio: form.bio.trim() || undefined,
          skills: form.skillsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          location: form.location.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Builder profile submitted for review");
      setShowRegisterForm(false);
      queryClient.invalidateQueries({ queryKey: ["my-builder-profile"] });
      queryClient.invalidateQueries({ queryKey: ["builder-proposals", nearAccountId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to register"),
  });

  if (isLoading) {
    return (
      <Card className={`${profileCardClassName} min-h-[168px]`}>
        <CardContent className="flex h-full min-h-[168px] items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Checking builder profile...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!builderProfile && !builderProposal) {
    return (
      <Card className={profileCardClassName}>
        <CardHeader className="bg-brand-accent-light/60 pb-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted">
              <Hammer size={14} className="text-brand-cyan" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Builder Profile
            </p>
            <BuilderStatusPill status="not-listed" />
          </div>
          <CardTitle className="text-base">Get discovered as a builder</CardTitle>
          <p className="text-sm text-muted-foreground">
            Register to appear in the NEAR Builders directory. Applications are reviewed by admins.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {showRegisterForm ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                registerMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="field-name"
                  className="text-xs font-semibold text-muted-foreground mb-1 block"
                >
                  Display name
                </label>
                <Input
                  id="field-name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  maxLength={100}
                />
              </div>
              <div>
                <label
                  htmlFor="field-bio"
                  className="text-xs font-semibold text-muted-foreground mb-1 block"
                >
                  Bio
                </label>
                <Textarea
                  id="field-bio"
                  placeholder="What do you build? What are you working on?"
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  maxLength={1000}
                  rows={3}
                />
              </div>
              <div>
                <label
                  htmlFor="field-skills"
                  className="text-xs font-semibold text-muted-foreground mb-1 block"
                >
                  Skills <span className="font-normal">(comma-separated)</span>
                </label>
                <Input
                  id="field-skills"
                  placeholder="React, Rust, Smart Contracts..."
                  value={form.skillsRaw}
                  onChange={(e) => setForm((f) => ({ ...f, skillsRaw: e.target.value }))}
                />
              </div>
              <div>
                <label
                  htmlFor="field-location"
                  className="text-xs font-semibold text-muted-foreground mb-1 block"
                >
                  Location
                </label>
                <Input
                  id="field-location"
                  placeholder="City, Country or Remote"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  maxLength={100}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={registerMutation.isPending}>
                  {registerMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                  Submit application
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRegisterForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button size="sm" className="rounded-full" onClick={() => setShowRegisterForm(true)}>
              <Hammer size={13} />
              Register as a builder
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!builderProfile && builderProposal) {
    const proposalPayload = readProposalPayload(builderProposal.payload);

    return (
      <Card className={profileCardClassName}>
        <CardHeader className="bg-brand-accent-light/60 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted">
                <Hammer size={14} className="text-brand-cyan" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Builder application
              </p>
            </div>
            <BuilderStatusPill status={builderProposal.reviewStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="rounded-xl border border-border bg-muted/35 p-4">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-foreground">
                {proposalPayload.name || "Builder application"}
              </div>
              {proposalPayload.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={10} />
                  {proposalPayload.location}
                </div>
              )}
            </div>

            {proposalPayload.bio && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {proposalPayload.bio}
              </p>
            )}

            {proposalPayload.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {proposalPayload.skills.slice(0, 6).map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="rounded-full px-2 py-0.5 text-xs"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {builderProposal.reviewStatus === "pending" && (
            <div className="flex gap-3 rounded-xl border border-brand-cobalt/20 bg-brand-cobalt/10 px-3.5 py-3 text-sm">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-cobalt" />
              <div>
                <p className="font-semibold text-foreground">Waiting for review</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Your public listing is queued. Keep your projects updated while the profile is
                  reviewed.
                </p>
              </div>
            </div>
          )}

          {builderProposal.reviewStatus === "rejected" && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-sm">
              <span className="font-semibold text-destructive">Not approved</span>
              {builderProposal.rejectionReason && (
                <span className="text-muted-foreground"> - {builderProposal.rejectionReason}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const approvedBuilder = builderProfile!;

  return (
    <Card className={profileCardClassName}>
      <CardHeader className="bg-brand-accent-light/60 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hammer size={14} className="text-muted-foreground" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Builder Profile
            </p>
          </div>
          <BuilderStatusPill status="approved" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground text-sm">
            {approvedBuilder.name || "Your builder profile is live"}
          </div>
          {approvedBuilder.location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={10} />
              {approvedBuilder.location}
            </div>
          )}
        </div>

        {approvedBuilder.bio && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {approvedBuilder.bio}
          </p>
        )}

        {approvedBuilder.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {approvedBuilder.skills.slice(0, 6).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild size="sm" variant="ghost">
            <Link to="/builders/$account/edit" params={{ account: nearAccountId }}>
              Edit builder profile
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BuilderStatusPill({ status }: { status: ProposalStatus | "approved" | "not-listed" }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-accent-light border border-brand-accent text-foreground">
        <Check size={9} />
        approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/30 text-destructive">
        <X size={9} />
        not approved
      </span>
    );
  }
  if (status === "not-listed") {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        not listed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
      pending review
    </span>
  );
}

function DashboardHeader({
  nearAccountId,
  nearProfile,
  showPublicProfile = false,
}: {
  nearAccountId?: string | null;
  nearProfile?: Profile | null;
  showPublicProfile?: boolean;
}) {
  const displayName = nearProfile?.name?.trim() || nearAccountId?.split(".")[0] || "builder";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-accent-border bg-gradient-to-br from-brand-accent-light via-card to-muted shadow-sm">
      <div
        className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full border-[24px] border-brand-accent-border/40"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-28 left-1/2 h-48 w-48 rounded-full border-[18px] border-brand-accent-border/25"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-mint-foreground/70">
              Builder workspace
            </p>
            {nearAccountId && (
              <span className="max-w-full truncate rounded-full border border-brand-accent-border bg-background/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-mint-foreground/80">
                {nearAccountId}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {nearAccountId ? `Welcome back, ${displayName}` : "Builder dashboard"}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage your profile, projects, ideas, and builder activity from one focused workspace.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          {showPublicProfile && nearAccountId && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 h-9 gap-1.5 rounded-full border-brand-accent-border bg-background/70 px-3 text-xs sm:flex-none"
            >
              <Link to="/builders/$account" params={{ account: nearAccountId }}>
                View public profile
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          {nearAccountId && (
            <Button
              asChild
              size="sm"
              className="order-last h-9 w-full gap-1.5 rounded-full px-4 text-xs sm:order-none sm:w-auto"
            >
              <Link to="/projects/new" search={{ tab: "write" }}>
                <Plus className="h-3.5 w-3.5" />
                New project or idea
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            size="icon"
            className="rounded-full border-brand-accent-border bg-background/70"
            aria-label="Settings"
          >
            <Link to="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface Project {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "project" | "idea" | "scope" | "result";
  status: "active" | "paused" | "archived";
  visibility: "private" | "unlisted" | "public";
}

function ProjectRow({ project, voteCount }: { project: Project; voteCount?: number }) {
  return (
    <Link
      to="/projects/$kind/$slug"
      params={{ kind: project.kind, slug: project.slug }}
      className="group block border-b border-border last:border-b-0"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <KindChip kind={project.kind} />
            <p className="truncate text-sm font-medium text-foreground">{project.title}</p>
          </div>
          {project.description && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {typeof voteCount === "number" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <ThumbsUp className="h-3 w-3" />
              {voteCount}
            </span>
          )}
          <StatusChip status={project.status} />
        </div>
      </div>
    </Link>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  paused: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  archived: "bg-muted text-muted-foreground border-border",
};

const KIND_STYLES: Record<Project["kind"], string> = {
  project: "bg-brand-green/10 text-brand-green border-brand-green/20",
  idea: "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20",
  scope: "bg-muted text-muted-foreground border-border",
  result: "bg-brand-accent-light text-brand-accent border-brand-accent/20",
};

function KindChip({ kind }: { kind: Project["kind"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${KIND_STYLES[kind]}`}
    >
      {kind}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.archived}`}
    >
      {status}
    </span>
  );
}
