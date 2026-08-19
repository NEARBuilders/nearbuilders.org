import type { ColumnDef } from "@tanstack/react-table";
import { Check, CheckCircle2, Clock3, ExternalLink, Send, XCircle } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type XNominationRecord, xNominationContext } from "@/lib/x-nomination-queue";
import { DataTable } from "./-data-table";
import { formatDate } from "./-proposal-dashboard";

type XNominationStatus = XNominationRecord["engagementStatus"];

function statusLabel(status: XNominationStatus) {
  return status === "pending_contact"
    ? "Pending"
    : status.charAt(0).toUpperCase() + status.slice(1);
}

export function XNominationStatusBadge({ status }: { status: XNominationStatus }) {
  const icon =
    status === "completed" ? (
      <CheckCircle2 />
    ) : status === "rejected" ? (
      <XCircle />
    ) : status === "contacted" ? (
      <Check />
    ) : (
      <Clock3 />
    );
  const variant =
    status === "completed"
      ? "success"
      : status === "rejected"
        ? "destructive"
        : status === "contacted"
          ? "outline"
          : "secondary";

  return (
    <Badge variant={variant} className="rounded-full px-2.5 py-1">
      {icon}
      {statusLabel(status)}
    </Badge>
  );
}

const ACTIONS_META = {
  thClassName: "w-px whitespace-nowrap px-2 text-right",
  tdClassName: "w-px whitespace-nowrap px-2",
};

export function XNominationTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: XNominationRecord[];
  selectedId?: string;
  onSelect: (row: XNominationRecord) => void;
}) {
  const columns = useMemo<ColumnDef<XNominationRecord, any>[]>(
    () => [
      {
        id: "nominee",
        header: "Nominee",
        cell: ({ row }) => {
          const nomination = row.original;
          const profile = nomination.linkedNomineeNearAccount ?? nomination.linkedNomineeBuilderId;
          return (
            <button
              type="button"
              className="block w-full min-w-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(nomination);
              }}
            >
              <span className="block truncate font-semibold text-foreground hover:underline">
                @{nomination.nomineeXUsername}
              </span>
              {profile && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  Existing builder · {profile}
                </span>
              )}
            </button>
          );
        },
        meta: {
          thClassName: "min-w-52",
          tdClassName: "min-w-52 max-w-64 whitespace-normal",
        },
      },
      {
        id: "referral",
        header: "Referral",
        cell: ({ row }) => {
          const nomination = row.original;
          const context = xNominationContext(nomination);
          return (
            <div className="min-w-0">
              {nomination.sourceReferralCount > 1 && (
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5">
                    {nomination.sourceReferralCount} referrals
                  </Badge>
                </div>
              )}
              <p className="line-clamp-2 text-sm leading-5 text-foreground">
                {context ?? <span className="text-muted-foreground">No additional context</span>}
              </p>
            </div>
          );
        },
        meta: {
          thClassName: "min-w-80",
          tdClassName: "min-w-80 max-w-xl whitespace-normal",
        },
      },
      {
        id: "nominator",
        header: "Nominated by",
        cell: ({ row }) => (
          <a
            href={`https://x.com/${row.original.nominatorXUsername}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium text-brand-cyan hover:underline"
          >
            @{row.original.nominatorXUsername}
          </a>
        ),
        meta: {
          thClassName: "min-w-44",
          tdClassName: "min-w-44 max-w-56 whitespace-normal",
        },
      },
      {
        id: "activity",
        header: "Activity",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-sm">
            <span className="block text-foreground">
              {formatDate(row.original.sourcePostCreatedAt ?? row.original.createdAt)}
            </span>
            <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
              {row.original.openCount} link open{row.original.openCount === 1 ? "" : "s"}
            </span>
          </div>
        ),
        meta: {
          thClassName: "w-px whitespace-nowrap",
          tdClassName: "w-px whitespace-nowrap",
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <XNominationStatusBadge status={row.original.engagementStatus} />,
        meta: {
          thClassName: "w-px whitespace-nowrap px-2",
          tdClassName: "w-px whitespace-nowrap px-2",
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" onClick={() => onSelect(row.original)}>
              <Send />
              Review
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="icon-sm" variant="ghost" aria-label="Open source post on X">
                  <a href={row.original.sourcePostUrl} target="_blank" rel="noreferrer">
                    <ExternalLink />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open source post</TooltipContent>
            </Tooltip>
          </div>
        ),
        meta: ACTIONS_META,
      },
    ],
    [onSelect],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      rowId={(row) => row.id}
      ariaLabel="X nomination review queue"
      selectedKey={selectedId}
      getSelectedKey={(row) => row.id}
      onRowClick={onSelect}
    />
  );
}

export function XNominationTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex h-10 items-center gap-6 border-b border-border bg-secondary px-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="ml-auto h-3 w-20" />
      </div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex h-20 items-center gap-6 border-b border-border px-4 last:border-0"
        >
          <div className="w-52 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="w-80 space-y-2">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="ml-auto h-7 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
