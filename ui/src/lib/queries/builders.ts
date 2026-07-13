import type { QueryClient } from "@tanstack/react-query";
import type { Profile } from "better-near-auth";
import type { ApiClient, AuthClient } from "@/app";

export const PAGE_SIZE = 24;

export interface Builder {
  id: string;
  nearAccount: string;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
}

export interface ProposalPayload {
  name?: string;
  bio?: string;
  skills?: string[];
  location?: string;
}

export interface Proposal {
  id: string;
  pluginId: string;
  entityId: string;
  operation: string;
  payload: unknown;
  schemaVersion: string;
  createdBy: string;
  reviewStatus: "pending" | "approved" | "rejected" | "removed";
  applyStatus: string;
  removeStatus: string;
  rejectionReason: string | null;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export function buildersInfiniteOptions(
  apiClient: ApiClient,
  search: string,
  limit: number = PAGE_SIZE,
) {
  return {
    queryKey: ["builders", search] as const,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiClient.listBuilders({
        search: search || undefined,
        limit,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: { meta: { hasMore: boolean; nextCursor: string | null } }) =>
      lastPage.meta.hasMore ? (lastPage.meta.nextCursor ?? undefined) : undefined,
  };
}

export function pendingProposalsOptions(apiClient: ApiClient) {
  return {
    queryKey: ["proposals", "builders", "pending"] as const,
    queryFn: () =>
      apiClient.getProposals({
        pluginId: "builders",
        reviewStatus: "pending" as const,
        limit: 100,
      }),
    staleTime: 30_000,
  };
}

const UPVOTE_BATCH_SIZE = 100;

function batchEntityIds(entityIds: string[]): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < entityIds.length; i += UPVOTE_BATCH_SIZE) {
    batches.push(entityIds.slice(i, i + UPVOTE_BATCH_SIZE));
  }
  return batches;
}

export function upvoteCountsOptions(apiClient: ApiClient, entityIds: string[]) {
  return {
    queryKey: ["upvoteCounts", entityIds] as const,
    queryFn: async () => {
      const results = await Promise.all(
        batchEntityIds(entityIds).map((ids) => apiClient.getUpvoteCounts({ entityIds: ids })),
      );
      return Object.assign({}, ...results) as Record<
        string,
        { entityId: string; totalCount: number }
      >;
    },
    enabled: entityIds.length > 0,
    staleTime: 30_000,
  };
}

export function userVotesOptions(
  apiClient: ApiClient,
  entityIds: string[],
  isAuthenticated: boolean,
) {
  return {
    queryKey: ["userVotes", entityIds] as const,
    queryFn: async () => {
      const results = await Promise.all(
        batchEntityIds(entityIds).map((ids) => apiClient.getUserVotes({ entityIds: ids })),
      );
      return Object.assign({}, ...results) as Record<
        string,
        { entityId: string; hasUpvote: boolean }
      >;
    },
    enabled: isAuthenticated && entityIds.length > 0,
  };
}

export function builderProposalsOptions(apiClient: ApiClient, entityId: string) {
  return {
    queryKey: ["proposals", "builders", entityId] as const,
    queryFn: () =>
      apiClient.getProposals({
        pluginId: "builders",
        entityId,
        limit: 100,
      }),
    enabled: !!entityId,
    staleTime: 30_000,
  };
}

export function nearProfileOptions(authClient: AuthClient, accountId: string) {
  return {
    queryKey: ["near-profile", accountId] as const,
    queryFn: async (): Promise<Profile | null> => {
      const res = await authClient.near.getProfile(accountId);
      return res.data || null;
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  };
}

export async function ensureNearProfiles(
  queryClient: QueryClient,
  authClient: AuthClient,
  accountIds: Array<string | null | undefined>,
) {
  const uniqueAccountIds = Array.from(
    new Set(accountIds.filter((accountId): accountId is string => Boolean(accountId))),
  );
  await Promise.allSettled(
    uniqueAccountIds.map((accountId) =>
      queryClient.ensureQueryData(nearProfileOptions(authClient, accountId)),
    ),
  );
}
