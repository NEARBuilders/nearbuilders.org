import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient, AuthClient } from "@/app";
import { resolveProjectNearAccount } from "../near-social";
import { fetchRepositoryLastCommitDate, fetchRepositoryReadme } from "../repository-content";
import { organizationsQueryOptions } from "../workspace";
import { nearProfileOptions } from "./builders";

/** GitHub content is unauthenticated and rate-limit prone, so keep it around for a while. */
export const REPOSITORY_CONTENT_STALE_TIME = 10 * 60_000;

export function projectBySlugOptions(apiClient: ApiClient, slug: string) {
  return {
    queryKey: ["project", slug] as const,
    queryFn: () => apiClient.getProjectBySlug({ slug }),
    // A missing project won't appear on retry; don't refetch it 3 more times.
    retry: (failureCount: number, error: unknown) => !isNotFoundError(error) && failureCount < 3,
    // If the loader already got an error, render it instead of fetching again on mount.
    retryOnMount: false,
  };
}

export function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "NOT_FOUND"
  );
}

type ProjectBySlugResult = Awaited<ReturnType<ApiClient["getProjectBySlug"]>>;
type ProjectDetail = NonNullable<ProjectBySlugResult["data"]>;

interface RepositoryProject {
  id?: string;
  kind?: string;
  repository?: string | null;
}

function hasRepositoryContent(project: RepositoryProject | null | undefined) {
  return project?.kind === "project" && Boolean(project.repository);
}

export function projectReadmeOptions(project: RepositoryProject | null | undefined) {
  return {
    queryKey: ["readme", project?.id, project?.repository] as const,
    queryFn: async () => {
      if (!project?.repository) return null;
      return await fetchRepositoryReadme(project.repository);
    },
    enabled: hasRepositoryContent(project),
    staleTime: REPOSITORY_CONTENT_STALE_TIME,
    retry: false,
  };
}

export function projectLastCommitOptions(project: RepositoryProject | null | undefined) {
  return {
    queryKey: ["lastCommit", project?.id, project?.repository] as const,
    queryFn: async () => {
      if (!project?.repository) return null;
      return await fetchRepositoryLastCommitDate(project.repository);
    },
    enabled: hasRepositoryContent(project),
    staleTime: REPOSITORY_CONTENT_STALE_TIME,
    retry: false,
  };
}

export function projectUpvoteCountOptions(apiClient: ApiClient, projectId: string | undefined) {
  return {
    queryKey: ["upvoteCount", projectId] as const,
    queryFn: () => apiClient.getUpvoteCount({ entityId: projectId! }),
    enabled: Boolean(projectId),
  };
}

export function projectUserVoteOptions(
  apiClient: ApiClient,
  projectId: string | undefined,
  canParticipate: boolean,
) {
  return {
    queryKey: ["userVoteState", projectId] as const,
    queryFn: () => apiClient.getUserVote({ entityId: projectId! }),
    enabled: canParticipate && Boolean(projectId),
  };
}

export function projectCollaboratorsOptions(apiClient: ApiClient, projectId: string) {
  return {
    queryKey: ["project-collaborators", projectId] as const,
    queryFn: () => apiClient.listCollaborators({ projectId }),
  };
}

export function projectSocialAccount(project: ProjectDetail | null | undefined) {
  return (
    resolveProjectNearAccount({
      ownerId: project?.ownerId,
      apps: (project as { apps?: Array<{ accountId: string }> } | undefined)?.apps,
    }) ?? ""
  );
}

export interface PrefetchProjectDetailInput {
  queryClient: QueryClient;
  apiClient: ApiClient;
  authClient: AuthClient;
  slug: string;
  isAuthenticated: boolean;
}

/**
 * Loads what the project detail page renders first, in parallel, into the same
 * query cache the page reads. Only the project itself is awaited (it drives
 * `head()` and the page shell) and it is fetched once. Organizations start
 * alongside it; votes, collaborators, NEAR profile and the GitHub README /
 * last-commit lookups are dispatched together the moment it lands and are not
 * awaited, so each section paints progressively with its own skeleton.
 */
export async function prefetchProjectDetail({
  queryClient,
  apiClient,
  authClient,
  slug,
  isAuthenticated,
}: PrefetchProjectDetailInput): Promise<ProjectDetail | null> {
  // Organizations don't depend on the project, so start them right away.
  if (isAuthenticated) void queryClient.prefetchQuery(organizationsQueryOptions(authClient));

  const project = await queryClient
    .ensureQueryData(projectBySlugOptions(apiClient, slug))
    .then((result) => result?.data ?? null)
    .catch(() => null);

  if (!project) return null;

  // Everything keyed on the project goes out together, without blocking the
  // first paint: the page subscribes to these in-flight queries (no refetch)
  // and fills in each section as its data lands. prefetchQuery never throws.
  const account = projectSocialAccount(project);
  void queryClient.prefetchQuery(projectUpvoteCountOptions(apiClient, project.id));
  void queryClient.prefetchQuery(projectCollaboratorsOptions(apiClient, project.id));
  if (isAuthenticated) {
    void queryClient.prefetchQuery(projectUserVoteOptions(apiClient, project.id, true));
  }
  if (account) void queryClient.prefetchQuery(nearProfileOptions(authClient, account));
  if (hasRepositoryContent(project)) {
    // GitHub is unauthenticated and rate-limit prone; cached for 10 min, no retries.
    void queryClient.prefetchQuery(projectReadmeOptions(project));
    void queryClient.prefetchQuery(projectLastCommitOptions(project));
  }

  return project;
}
