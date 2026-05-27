import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import type { Profile } from "better-near-auth";
import { useApiClient, useAuthClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_layout/builders/$account")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.account} | NEAR Builders` },
      {
        name: "description",
        content: `Builder profile for ${params.account} on NEAR Builders.`,
      },
    ],
  }),
  component: BuilderProfilePage,
  notFoundComponent: BuilderNotFound,
});

type BuilderData = NonNullable<
  Awaited<ReturnType<ReturnType<typeof useApiClient>["builders"]["getBuilder"]>>["data"]
>;

function BuilderProfilePage() {
  const { account } = Route.useParams();
  const apiClient = useApiClient();

  const { data: builderResult, isLoading } = useQuery({
    queryKey: ["builder", account],
    queryFn: () => apiClient.builders.getBuilder({ nearAccount: account }),
    retry: false,
  });

  if (isLoading) return <ProfileSkeleton account={account} />;
  if (!builderResult?.data) return <BuilderNotFound />;

  return <LoadedProfile account={account} builder={builderResult.data} />;
}

function LoadedProfile({ account, builder }: { account: string; builder: BuilderData }) {
  const auth = useAuthClient();
  const apiClient = useApiClient();

  const { data: profile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["near-profile", account],
    queryFn: async () => {
      const res = await auth.near.getProfile(account);
      return res.data || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: projectsResult, isLoading: projectsLoading } = useQuery({
    queryKey: ["builder-projects", account],
    queryFn: () =>
      apiClient.projects.listProjects({
        ownerId: account,
        visibility: "public",
        limit: 6,
      }),
  });

  const projects = projectsResult?.data ?? [];

  const displayName = builder.name || profile?.name || account;
  const bio = builder.bio || profile?.description || null;

  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid
      ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}`
      : null);

  const backgroundUrl =
    profile?.backgroundImage?.url ??
    (profile?.backgroundImage?.ipfs_cid
      ? `https://ipfs.near.social/ipfs/${profile.backgroundImage.ipfs_cid}`
      : null);

  const allLinks: Record<string, string> = {};
  if (profile?.linktree) {
    for (const [k, v] of Object.entries(profile.linktree)) {
      if (typeof v === "string") allLinks[k] = v;
    }
  }
  for (const [k, v] of Object.entries(builder.links ?? {})) {
    allLinks[k] = v;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link
          to="/builders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          All builders
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
        <div className="relative h-36 bg-gradient-to-r from-brand-green/30 to-brand-cyan/30">
          {backgroundUrl && (
            <img
              src={backgroundUrl}
              alt="Profile background"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="absolute -bottom-8 left-6">
            <div className="size-16 rounded-full overflow-hidden bg-muted border-4 border-card flex items-center justify-center">
              {profileLoading ? (
                <Skeleton className="size-16 rounded-full" />
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="size-16 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="text-xl font-black text-muted-foreground">
                  {getInitials(displayName)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-12 px-6 pb-6">
          {profileLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black text-foreground leading-tight">{displayName}</h1>
              <p className="text-sm font-mono text-brand-cyan mt-0.5">{account}</p>
              {builder.location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin size={12} />
                  {builder.location}
                </div>
              )}
            </>
          )}

          {bio && (
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">{bio}</p>
          )}

          {builder.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {builder.skills.map((skill) => (
                <Badge
                  key={skill}
                  variant="secondary"
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          )}

          {Object.keys(allLinks).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {Object.entries(allLinks).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-secondary border border-border hover:bg-muted transition-colors font-medium"
                >
                  {platform}
                  <ExternalLink size={10} className="opacity-50" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Projects</h2>
        {projectsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-secondary h-20 rounded-lg" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">No public projects yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                to="/projects/$id"
                params={{ id: project.id }}
                className="group bg-card border border-border rounded-lg px-4 py-3 hover:border-border/80 hover:shadow-sm transition-all duration-150 flex flex-col gap-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate flex-1">
                    {project.title}
                  </span>
                  <span className="text-[10px] font-semibold border border-border rounded-[3px] px-1.5 py-0.5 text-muted-foreground shrink-0">
                    {project.kind}
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs text-muted-foreground truncate">{project.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}

        {(projectsResult?.meta.hasMore ?? false) && (
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/projects" search={{ kind: "all", personal: undefined, private: undefined }}>
                View all projects
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileSkeleton({ account }: { account: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link
          to="/builders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          All builders
        </Link>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
        <Skeleton className="h-36 w-full rounded-none" />
        <div className="pt-12 px-6 pb-6 space-y-3">
          <Skeleton className="h-7 w-40" />
          <p className="text-sm font-mono text-brand-cyan">{account}</p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

function BuilderNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="text-4xl mb-4">🔍</div>
      <h1 className="text-xl font-bold text-foreground mb-2">Builder not found</h1>
      <p className="text-sm text-muted-foreground mb-6">
        This builder profile doesn't exist or hasn't been approved yet.
      </p>
      <Button asChild variant="outline">
        <Link to="/builders">Browse builders</Link>
      </Button>
    </div>
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
