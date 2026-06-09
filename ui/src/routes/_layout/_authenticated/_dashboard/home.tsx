import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  ExternalLink,
  FolderOpen,
  Hammer,
  Loader2,
  MapPin,
  Plus,
  Settings,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type SessionData, sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { NearProfile } from "@/components/near-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/home")({
  head: () => ({
    meta: [{ title: "Home | app" }, { name: "description", content: "Your builder home." }],
  }),
  component: Home,
});

const RECENT_PROJECTS_LIMIT = 5;

function Home() {
  const auth = useAuthClient();
  const apiClient = useApiClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const user = session?.user;

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
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

  if (!user) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
        <DashboardHeader />
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    );
  }

  if (!nearAccountId) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
        <DashboardHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Connect your NEAR wallet</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              Link a NEAR account to access your builder profile, projects, and more.
            </p>
          </div>
          <Button onClick={() => auth.signIn.near()}>Connect NEAR wallet</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <DashboardHeader />

      <div className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <NearProfile accountId={nearAccountId} variant="card" />

          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/projects"
              search={{ personal: true }}
              className="group relative flex flex-col rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:border-foreground/20 hover:shadow-md"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
                <FolderOpen className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              {projectsLoading ? (
                <Skeleton className="mb-1 h-7 w-12" />
              ) : (
                <span className="text-2xl font-bold text-foreground">{projectCount}</span>
              )}
              <span className="text-sm font-semibold text-foreground">Projects</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground/70">View all →</span>
            </Link>

            <a
              href="https://hub.ironclaw.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:border-foreground/20 hover:shadow-md"
            >
              <ExternalLink
                size={10}
                className="absolute top-2.5 right-2.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              />
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
                <Zap className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <span className="text-2xl font-bold text-muted-foreground/30">—</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-muted-foreground/60">Skills</span>
                <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                  soon
                </span>
              </div>
              <span className="mt-0.5 text-[11px] text-muted-foreground/40">hub.ironclaw.com</span>
            </a>
          </div>

          <BuilderProfileCard
            builderProfile={builderProfile}
            builderProposal={builderProposal}
            isLoading={builderLoading || builderProposalLoading}
            nearAccountId={nearAccountId}
            apiClient={apiClient}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recent Projects</h2>
              <Button asChild size="sm" className="h-7 gap-1 text-xs">
                <Link to="/projects/new" search={{ tab: "write" }}>
                  <Plus className="h-3 w-3" />
                  New project
                </Link>
              </Button>
            </div>

            {projectsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No projects yet.</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/projects/new" search={{ tab: "write" }}>
                      Create your first project
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {projects.map((project) => (
                  <ProjectRow key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BuilderProfileData {
  nearAccount: string;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
}

type ProposalStatus = "pending" | "approved" | "rejected" | "removed";

interface BuilderProposalData {
  pluginId: string;
  entityId: string;
  payload: unknown;
  reviewStatus: ProposalStatus;
  rejectionReason: string | null;
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Checking builder profile…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!builderProfile && !builderProposal) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Hammer size={14} className="text-muted-foreground" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Builder Profile
            </p>
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
                  placeholder="React, Rust, Smart Contracts…"
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
            <Button size="sm" onClick={() => setShowRegisterForm(true)}>
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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hammer size={14} className="text-muted-foreground" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Builder Proposal
              </p>
            </div>
            <BuilderStatusPill status={builderProposal.reviewStatus} />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-0.5">
            <div className="font-semibold text-foreground text-sm">
              {proposalPayload.name || nearAccountId}
            </div>
            <div className="text-xs font-mono text-brand-cyan">{nearAccountId}</div>
            {proposalPayload.location && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={10} />
                {proposalPayload.location}
              </div>
            )}
          </div>

          {proposalPayload.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {proposalPayload.bio}
            </p>
          )}

          {proposalPayload.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {proposalPayload.skills.slice(0, 6).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                  {skill}
                </Badge>
              ))}
            </div>
          )}

          {builderProposal.reviewStatus === "pending" && (
            <div className="rounded-lg bg-muted border border-border text-sm text-muted-foreground px-3 py-2.5">
              Your application is under review. We'll update your status soon.
            </div>
          )}

          {builderProposal.reviewStatus === "rejected" && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 text-sm px-3 py-2.5">
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
    <Card>
      <CardHeader className="pb-3">
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
            {approvedBuilder.name || nearAccountId}
          </div>
          <div className="text-xs font-mono text-brand-cyan">{nearAccountId}</div>
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

        <Button asChild size="sm" variant="outline">
          <Link to="/builders/$account" params={{ account: nearAccountId }}>
            View public profile →
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function BuilderStatusPill({ status }: { status: ProposalStatus | "approved" }) {
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
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
      pending review
    </span>
  );
}

function DashboardHeader() {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
      <h1 className="text-lg font-semibold text-foreground">Home</h1>
      <Button asChild variant="ghost" size="icon">
        <Link to="/settings">
          <Settings className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

interface Project {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "project" | "idea";
  status: "active" | "paused" | "archived";
  visibility: "private" | "unlisted" | "public";
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <Link to="/projects/$id" params={{ id: project.id }} className="block">
      <Card className="transition-colors hover:bg-muted/40">
        <CardHeader className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-sm font-medium">{project.title}</CardTitle>
              {project.description && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{project.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusChip status={project.status} />
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  paused: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  archived: "bg-muted text-muted-foreground border-border",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.archived}`}
    >
      {status}
    </span>
  );
}
