import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { NotificationSourceIcon } from "@/components/notification-source-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationStream,
  useOpenNotification,
} from "@/hooks";
import {
  formatRelativeTime,
  infiniteNotificationsQueryOptions,
  type NotificationRecord,
  notificationTypeLabel,
  unreadNotificationsQueryOptions,
} from "@/lib/queries/notifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/notifications")({
  loader: async ({ context }) => {
    await context.queryClient.prefetchInfiniteQuery(
      infiniteNotificationsQueryOptions(context.apiClient),
    );
  },
  head: () => ({
    meta: [{ title: "Notifications | NEAR Builders" }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const apiClient = useApiClient();
  const openNotification = useOpenNotification();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();
  useNotificationStream();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery(infiniteNotificationsQueryOptions(apiClient));
  const unreadQuery = useQuery(unreadNotificationsQueryOptions(apiClient));
  const notifications = data?.pages.flatMap((page) => page.data) ?? [];
  const unreadCount = unreadQuery.data?.meta.total ?? 0;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasNextPage || isFetchingNextPage) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      });
      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review approvals and updates for your builder activity.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={unreadCount === 0 || markAllAsRead.isPending}
          onClick={() => markAllAsRead.mutate()}
        >
          Mark all as read
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border bg-card px-6 py-16 text-center">
          <Bell className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold text-foreground">Couldn’t load notifications</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong. Please try again later.
          </p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-16 text-center">
          <Bell className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold text-foreground">No notifications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Approvals and updates will appear here when they are ready.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onOpen={() => void openNotification(notification)}
                onMarkRead={() => markAsRead.mutate(notification.id)}
              />
            ))}
          </div>
          <div ref={sentinelRef} className="flex justify-center py-6">
            {isFetchingNextPage && (
              <div className="size-5 animate-spin rounded-full border-2 border-border border-t-transparent" />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function NotificationCard({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: NotificationRecord;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer rounded-lg shadow-none transition-colors hover:bg-accent",
        !notification.read && "border-primary/40",
      )}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <CardContent className="flex gap-4 p-4">
        <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <NotificationSourceIcon source={notification.source} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={notification.read ? "secondary" : "default"}>
              {notificationTypeLabel(notification.type)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </span>
            {!notification.read && <span className="size-2 rounded-full bg-primary" />}
          </div>
          <h2
            className={cn(
              "mt-2 text-base text-foreground",
              notification.read ? "font-medium" : "font-semibold",
            )}
          >
            {notification.subject}
          </h2>
          {notification.body && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notification.body}</p>
          )}
          {notification.type === "project_collab_invite" && (
            <CollabInviteActions link={notification.link} />
          )}
        </div>
        {!notification.read && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 self-start text-muted-foreground"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onMarkRead();
            }}
          >
            <Check className="size-4" />
            <span className="hidden sm:inline">Mark as read</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CollabInviteActions({ link }: { link: string }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const slug = link.split("/").filter(Boolean).pop() ?? "";

  const projectQuery = useQuery({
    queryKey: ["collab-invite-project", slug],
    queryFn: () => apiClient.getProjectBySlug({ slug }),
    enabled: Boolean(slug),
    retry: false,
  });

  const projectId = projectQuery.data?.data?.id;

  const respondMutation = useMutation({
    mutationFn: (action: "accept" | "decline") => {
      if (!projectId) throw new Error("Project not available yet");
      return apiClient.respondCollaborator({ projectId, action });
    },
    onSuccess: () => {
      toast.success("Invitation updated");
      queryClient.invalidateQueries({ queryKey: ["collaborations"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to respond"),
  });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        disabled={!projectId || respondMutation.isPending}
        onClick={(e) => {
          e.stopPropagation();
          respondMutation.mutate("accept");
        }}
      >
        Accept
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!projectId || respondMutation.isPending}
        onClick={(e) => {
          e.stopPropagation();
          respondMutation.mutate("decline");
        }}
      >
        Decline
      </Button>
      <Button type="button" size="sm" variant="ghost" asChild>
        <Link to="/dashboard" onClick={(e) => e.stopPropagation()}>
          Review in dashboard
        </Link>
      </Button>
    </div>
  );
}
