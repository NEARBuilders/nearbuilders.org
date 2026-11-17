import { getEventMeta } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { useApiClient, useOrpc } from "@/app";
import {
  addNotificationToCache,
  markAllNotificationsReadInCache,
  markNotificationReadInCache,
  type NotificationRecord,
  notificationKeys,
  restoreNotificationCaches,
  snapshotNotificationCaches,
} from "@/lib/queries/notifications";

/** Keeps the notification caches (lists + unread badge) in sync with the live SSE stream. */
export function useNotificationStream() {
  const orpc = useOrpc();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  // Kept across query retries so a reconnect after an error also resumes.
  const lastEventId = useRef<string | undefined>(undefined);
  useQuery({
    queryKey: orpc.subscribeNotifications.liveKey(),
    // The server ends each stream after a few minutes so it can re-check which accounts are
    // the caller's. Reopen it straight away, resuming after the last event so none are missed.
    queryFn: async ({ signal }): Promise<never> => {
      while (true) {
        const openedAt = Date.now();
        const stream = await apiClient.subscribeNotifications(undefined, {
          signal,
          lastEventId: lastEventId.current,
        });
        for await (const event of stream) {
          lastEventId.current = getEventMeta(event)?.id ?? lastEventId.current;
          addNotificationToCache(queryClient, event);
        }
        signal.throwIfAborted();
        // Don't spin if a stream keeps ending right away.
        if (Date.now() - openedAt < 5_000) {
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, 5_000);
            const stop = () => {
              clearTimeout(timer);
              resolve(undefined);
            };
            signal.addEventListener("abort", stop, { once: true });
          });
          signal.throwIfAborted();
        }
      }
    },
    retry: true,
  });
}

export function useMarkNotificationRead() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.markNotificationAsRead({ id }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previous = snapshotNotificationCaches(queryClient);
      markNotificationReadInCache(queryClient, id);
      return { previous };
    },
    onError: (_error, _id, context) => restoreNotificationCaches(queryClient, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.markAllNotificationsAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previous = snapshotNotificationCaches(queryClient);
      markAllNotificationsReadInCache(queryClient);
      return { previous };
    },
    onError: (_error, _vars, context) => restoreNotificationCaches(queryClient, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/** Marks a notification read (if unread) then navigates to its link. */
export function useOpenNotification() {
  const navigate = useNavigate();
  const markAsRead = useMarkNotificationRead();

  return async (notification: NotificationRecord) => {
    if (!notification.read) {
      await markAsRead.mutateAsync(notification.id).catch(() => {});
    }
    await navigate({ to: notification.link } as never);
  };
}
