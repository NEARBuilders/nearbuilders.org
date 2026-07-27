import { Link } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  Archive,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  PanelRightOpen,
  XCircle,
} from "lucide-react";
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
import {
  formatDate,
  getProjectKind,
  getProposalDescriptor,
  getProposalState,
  getProposalTitle,
  getProposalTypeLabel,
  hasCanonicalPage,
  type ProposalRecord,
  type ProposalState,
  readPayload,
  readString,
} from "./-proposal-dashboard";

export function ProposalStatusBadge({ state }: { state: ProposalState }) {
  const icon =
    state.tone === "approved" ? (
      <CheckCircle2 />
    ) : state.tone === "rejected" ? (
      <XCircle />
    ) : state.tone === "removed" ? (
      <Archive />
    ) : state.tone === "failed" ? (
      <CircleAlert />
    ) : (
      <Clock3 />
    );
  const variant =
    state.tone === "approved"
      ? "success"
      : state.tone === "rejected" || state.tone === "failed"
        ? "destructive"
        : state.tone === "removed"
          ? "outline"
          : "secondary";

  return (
    <Badge variant={variant} className="rounded-full px-2.5 py-1">
      {icon}
      {state.label}
    </Badge>
  );
}

function ProposalPageLink({ proposal }: { proposal: ProposalRecord }) {
  const payload = readPayload(proposal.payload);
  if (proposal.pluginId === "nearcatalog") return null;
  if (!hasCanonicalPage(proposal)) return null;
  if (proposal.pluginId === "builders") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            size="icon-sm"
            variant="ghost"
            className="size-10 sm:size-8"
            aria-label="Open builder page"
          >
            <Link to="/builders/$account" params={{ account: proposal.entityId }}>
              <ArrowUpRight />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          Open builder page
        </TooltipContent>
      </Tooltip>
    );
  }
  if (proposal.pluginId === "projects") {
    const slug = readString(payload.slug);
    if (!slug) return null;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            size="icon-sm"
            variant="ghost"
            className="size-10 sm:size-8"
            aria-label="Open project page"
          >
            <Link
              to="/projects/$kind/$slug"
              params={{ kind: getProjectKind(payload.kind), slug }}
              search={{}}
            >
              <ArrowUpRight />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          Open project page
        </TooltipContent>
      </Tooltip>
    );
  }
  if (proposal.pluginId === "events") {
    const slug = readString(payload.slug);
    if (!slug) return null;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            size="icon-sm"
            variant="ghost"
            className="size-10 sm:size-8"
            aria-label="Open event page"
          >
            <Link to="/events/$slug" params={{ slug }}>
              <ArrowUpRight />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          Open event page
        </TooltipContent>
      </Tooltip>
    );
  }
  return null;
}

export function ProposalTable({
  proposals,
  selectedEntityId,
  onSelect,
  onApprove,
  approvingEntityId,
}: {
  proposals: ProposalRecord[];
  selectedEntityId?: string;
  onSelect: (proposal: ProposalRecord) => void;
  onApprove: (proposal: ProposalRecord) => void;
  approvingEntityId?: string;
}) {
  const columns = useMemo<ColumnDef<ProposalRecord>[]>(
    () => [
      {
        id: "item",
        header: "Item",
        cell: ({ row }) => {
          const proposal = row.original;
          return (
            <button
              type="button"
              className="block w-full min-w-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(proposal);
              }}
            >
              <span className="block truncate font-semibold text-foreground hover:underline">
                {getProposalTitle(proposal)}
              </span>
              <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                {proposal.entityId}
              </span>
            </button>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => {
          const proposal = row.original;
          const descriptor = getProposalDescriptor(proposal);
          return (
            <>
              <span className="block capitalize text-foreground">
                {getProposalTypeLabel(proposal)}
              </span>
              {descriptor && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {descriptor}
                </span>
              )}
            </>
          );
        },
      },
      {
        accessorKey: "createdBy",
        header: "Submitted by",
        cell: ({ row }) => (
          <span className="block truncate font-mono text-xs text-foreground">
            {row.original.createdBy}
          </span>
        ),
      },
      {
        accessorKey: "submissionCount",
        header: "Submissions",
        cell: ({ row }) => row.original.submissionCount,
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => formatDate(row.original.updatedAt),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <ProposalStatusBadge state={getProposalState(row.original)} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const proposal = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              {proposal.reviewStatus === "pending" && (
                <Button
                  size="sm"
                  className="h-10 sm:h-8"
                  onClick={() => onApprove(proposal)}
                  disabled={Boolean(approvingEntityId)}
                >
                  {approvingEntityId === proposal.entityId ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check />
                  )}
                  Approve
                </Button>
              )}
              <Button
                size="icon-sm"
                variant="outline"
                className="size-10 sm:size-8"
                onClick={() => onSelect(proposal)}
                aria-label="Open proposal"
              >
                <PanelRightOpen />
              </Button>
              <ProposalPageLink proposal={proposal} />
            </div>
          );
        },
      },
    ],
    [approvingEntityId, onApprove, onSelect],
  );
  const table = useReactTable({
    data: proposals,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (proposal) => proposal.id,
  });

  return (
    <TooltipProvider>
      <Table
        aria-label="Admin proposal records"
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
                    header.column.id === "item" && "min-w-64",
                    header.column.id === "type" && "min-w-28",
                    header.column.id === "createdBy" && "min-w-44",
                    (header.column.id === "submissionCount" ||
                      header.column.id === "updatedAt" ||
                      header.column.id === "status" ||
                      header.column.id === "actions") &&
                      "w-px whitespace-nowrap",
                    header.column.id === "submissionCount" && "text-center",
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
              data-state={selectedEntityId === row.original.entityId ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => onSelect(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    "min-w-0",
                    cell.column.id === "item" && "min-w-64 max-w-80 whitespace-normal py-3",
                    cell.column.id === "type" && "min-w-28 max-w-40 whitespace-normal py-3",
                    cell.column.id === "createdBy" && "min-w-44 max-w-56",
                    (cell.column.id === "submissionCount" ||
                      cell.column.id === "updatedAt" ||
                      cell.column.id === "status" ||
                      cell.column.id === "actions") &&
                      "w-px whitespace-nowrap",
                    cell.column.id === "submissionCount" && "text-center tabular-nums",
                    cell.column.id === "updatedAt" && "text-muted-foreground",
                    (cell.column.id === "status" || cell.column.id === "actions") && "px-2 py-3",
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
    </TooltipProvider>
  );
}

export function ProposalTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="flex h-10 min-w-full items-center gap-6 border-b border-border bg-secondary px-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="hidden h-3 w-16 sm:block" />
        <Skeleton className="ml-auto h-3 w-20" />
      </div>
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="flex h-16 min-w-full items-center gap-6 border-b border-border px-4 last:border-0"
        >
          <div className="w-72 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-7 w-28 rounded-full" />
        </div>
      ))}
    </div>
  );
}
