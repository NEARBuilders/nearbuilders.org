import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";

export function useBookmark(entityId: string) {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();

  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const canBookmark = Boolean(session?.user && !session.user.isAnonymous);

  const queryKey = ["bookmark", entityId];

  const bookmarkQuery = useQuery({
    queryKey,
    queryFn: () => apiClient.getUserBookmark({ entityId }),
    enabled: canBookmark,
    staleTime: 60_000,
  });

  const setCached = (isBookmarked: boolean) =>
    queryClient.setQueryData(queryKey, { entityId, isBookmarked });

  const bookmarkMutation = useMutation({
    mutationFn: () => apiClient.bookmark({ entityId }),
    onSuccess: () => setCached(true),
    onError: () => toast.error("Failed to bookmark"),
  });

  const unbookmarkMutation = useMutation({
    mutationFn: () => apiClient.unbookmark({ entityId }),
    onSuccess: () => setCached(false),
    onError: () => toast.error("Failed to remove bookmark"),
  });

  const isBookmarked = bookmarkQuery.data?.isBookmarked ?? false;

  const toggle = useCallback(() => {
    if (!canBookmark) return;
    if (isBookmarked) unbookmarkMutation.mutate();
    else bookmarkMutation.mutate();
  }, [canBookmark, isBookmarked, bookmarkMutation, unbookmarkMutation]);

  return { isBookmarked, toggle, canBookmark };
}
