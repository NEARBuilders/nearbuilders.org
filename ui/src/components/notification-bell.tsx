import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bell, Check } from "lucide-react";
import { useState } from "react";
import { useApiClient } from "@/app";
import { NotificationSourceIcon } from "@/components/notification-source-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationStream,
  useOpenNotification,
} from "@/hooks";
import {
  formatRelativeTime,
  notificationsQueryOptions,
  notificationTypeLabel,
  unreadNotificationsQueryOptions,
} from "@/lib/queries/notifications";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const apiClient = useApiClient();
  const openNotification = useOpenNotification();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);
  useNotificationStream();

  const recentQuery = useQuery(notificationsQueryOptions(apiClient, { limit: 5 }));
  const unreadQuery = useQuery(unreadNotificationsQueryOptions(apiClient));
  const unreadCount = unreadQuery.data?.meta.total ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative size-9 rounded-full"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          title="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl p-0 shadow-xl"
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                {unreadCount} unread
              </span>
            )}
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              disabled={markAllAsRead.isPending}
              onClick={() => markAllAsRead.mutate()}
            >
              Mark all as read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        {recentQuery.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : recentQuery.isError ? (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Bell className="size-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">
              Couldn’t load notifications
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Please try again in a moment.</p>
          </div>
        ) : recentQuery.data?.data.length ? (
          <div className="max-h-[min(26rem,calc(100vh-9rem))] space-y-1 overflow-y-auto p-2">
            {recentQuery.data.data.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "cursor-pointer items-start gap-3 rounded-lg px-3 py-3",
                  !notification.read && "bg-secondary/60",
                )}
                onSelect={() => {
                  setOpen(false);
                  void openNotification(notification);
                }}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground",
                    !notification.read && "bg-brand-cyan/10 text-brand-cyan",
                  )}
                >
                  <NotificationSourceIcon source={notification.source} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block line-clamp-2 text-sm leading-5 text-foreground",
                      notification.read ? "font-medium" : "font-semibold",
                    )}
                  >
                    {notification.subject}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{notificationTypeLabel(notification.type)}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">{formatRelativeTime(notification.createdAt)}</span>
                  </span>
                </span>
                {!notification.read && (
                  <button
                    type="button"
                    aria-label={`Mark ${notification.subject} as read`}
                    title="Mark as read"
                    className="self-center shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      markAsRead.mutate(notification.id);
                    }}
                  >
                    <Check className="size-4" />
                  </button>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Bell className="size-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Approvals and updates will appear here.
            </p>
          </div>
        )}
        <div className="border-t border-border p-2">
          <DropdownMenuItem
            asChild
            className="cursor-pointer justify-between rounded-lg px-3 py-2.5 text-sm font-semibold"
          >
            <Link to="/notifications">
              View all notifications
              <ArrowRight className="size-4" />
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
