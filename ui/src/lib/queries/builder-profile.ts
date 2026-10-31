import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient, AuthClient } from "@/app";
import { activityFeedWithProfilesQueryOptions } from "./activity";
import {
  builderDetailOptions,
  builderProposalsOptions,
  builderStatsOptions,
  nearProfileOptions,
  upvoteCountsOptions,
  userVotesOptions,
} from "./builders";
import { claimedCatalogProjectsQueryOptions } from "./catalog";

export const BUILDER_PROFILE_PROJECTS_LIMIT = 6;

export function builderOwnedProjectsOptions(apiClient: ApiClient, nearAccount: string) {
  return {
    queryKey: ["builder-projects", nearAccount] as const,
    queryFn: () =>
      apiClient.listProjects({
        ownerId: nearAccount,
        visibility: "public",
        limit: BUILDER_PROFILE_PROJECTS_LIMIT,
      }),
  };
}

export function builderTeamProjectsOptions(apiClient: ApiClient, nearAccount: string) {
  return {
    queryKey: ["builder-team-projects", nearAccount] as const,
    queryFn: () =>
      apiClient.listProjects({
        collaboratorId: nearAccount,
        visibility: "public",
        limit: BUILDER_PROFILE_PROJECTS_LIMIT,
      }),
  };
}

/** Same filters object shape the profile page passes to `<ActivityFeed />`. */
export function builderActivityFilters(nearAccount: string) {
  return { actor: nearAccount };
}

export interface PrefetchBuilderProfileInput {
  queryClient: QueryClient;
  apiClient: ApiClient;
  authClient: AuthClient;
  account: string;
  isAuthenticated: boolean;
}

/**
 * Loads everything the builder profile page renders in one parallel dispatch.
 * Only the vote lookups wait on proposals, because they need the proposal ids;
 * nothing else waits on anything. Every query uses the exact options the page
 * components read, so they render from this cache instead of fetching again.
 */
export async function prefetchBuilderProfile({
  queryClient,
  apiClient,
  authClient,
  account,
  isAuthenticated,
}: PrefetchBuilderProfileInput) {
  const builderPromise = queryClient
    .fetchQuery(builderDetailOptions(apiClient, account))
    .catch(() => null);

  const proposalsPromise = queryClient
    .fetchQuery(builderProposalsOptions(apiClient, account))
    .catch(() => {
      queryClient.resetQueries({ queryKey: ["proposals", "builders", account] });
      return null;
    });

  const votesPromise = proposalsPromise.then((proposalsResult) => {
    const proposalIds = proposalsResult?.data?.map((proposal) => proposal.id) ?? [];
    if (proposalIds.length === 0) return;
    return Promise.allSettled([
      queryClient.prefetchQuery(upvoteCountsOptions(apiClient, proposalIds)),
      ...(isAuthenticated
        ? [queryClient.prefetchQuery(userVotesOptions(apiClient, proposalIds, true))]
        : []),
    ]);
  });

  const profilePromise = queryClient
    .fetchQuery(nearProfileOptions(authClient, account))
    .catch(() => {
      queryClient.resetQueries({ queryKey: ["near-profile", account] });
    });

  const [builderResult] = await Promise.all([
    builderPromise,
    Promise.allSettled([
      proposalsPromise,
      votesPromise,
      profilePromise,
      queryClient.prefetchInfiniteQuery(
        activityFeedWithProfilesQueryOptions(
          apiClient,
          authClient,
          queryClient,
          builderActivityFilters(account),
        ),
      ),
      queryClient.prefetchQuery(claimedCatalogProjectsQueryOptions(apiClient, account)),
      queryClient.prefetchQuery(builderStatsOptions(apiClient, account)),
      queryClient.prefetchQuery(builderOwnedProjectsOptions(apiClient, account)),
      queryClient.prefetchQuery(builderTeamProjectsOptions(apiClient, account)),
    ]),
  ]);

  return builderResult?.data ?? null;
}
