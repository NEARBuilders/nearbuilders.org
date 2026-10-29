import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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
  const queryClient = useQueryClient();
  const { data: latest } = useQuery(orpc.subscribeNotifications.liveOptions({ retry: true }));

  useEffect(() => {
    if (!latest) return;
    addNotificationToCache(queryClient, latest);
  }, [latest, queryClient]);
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
