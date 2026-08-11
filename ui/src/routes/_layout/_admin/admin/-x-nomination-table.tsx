import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Check, CheckCircle2, Clock3, ExternalLink, Send, XCircle } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type XNominationRecord, xNominationContext } from "@/lib/x-nomination-queue";
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

export function XNominationTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: XNominationRecord[];
  selectedId?: string;
  onSelect: (row: XNominationRecord) => void;
}) {
  const columns = useMemo<ColumnDef<XNominationRecord>[]>(
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
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <XNominationStatusBadge status={row.original.engagementStatus} />,
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
      },
    ],
    [onSelect],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table
          aria-label="X nomination review queue"
          className="table-auto"
          style={{ width: "max-content", minWidth: "100%" }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.id === "nominee" && "min-w-52",
                      header.column.id === "referral" && "min-w-80",
                      header.column.id === "nominator" && "min-w-44",
                      (header.column.id === "activity" ||
                        header.column.id === "status" ||
                        header.column.id === "actions") &&
                        "w-px whitespace-nowrap",
                      (header.column.id === "status" || header.column.id === "actions") && "px-2",
                      header.column.id === "actions" && "text-right",
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={selectedId === row.original.id ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => onSelect(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "min-w-0 py-3",
                      cell.column.id === "nominee" && "min-w-52 max-w-64 whitespace-normal",
                      cell.column.id === "referral" && "min-w-80 max-w-xl whitespace-normal",
                      cell.column.id === "nominator" && "min-w-44 max-w-56 whitespace-normal",
                      (cell.column.id === "activity" ||
                        cell.column.id === "status" ||
                        cell.column.id === "actions") &&
                        "w-px whitespace-nowrap",
                      (cell.column.id === "status" || cell.column.id === "actions") && "px-2",
                    )}
                    onClick={
                      cell.column.id === "actions" ? (event) => event.stopPropagation() : undefined
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
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
