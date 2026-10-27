import {
  type ColumnDef,
  flexRender,
  type RowData,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ColumnMeta = {
  thClassName?: string;
  tdClassName?: string;
};

const dataTableFeatures = tableFeatures({
  columnMeta: {} as ColumnMeta,
});

export type DataTableColumnDef<T extends RowData> = ColumnDef<typeof dataTableFeatures, T, any>;

export type DataTableProps<T extends RowData> = {
  data: T[];
  columns: DataTableColumnDef<T>[];
  rowId: (row: T) => string;
  ariaLabel: string;
  selectedKey?: string;
  getSelectedKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  actionColumnId?: string;
};

export function DataTable<T extends RowData>({
  data,
  columns,
  rowId,
  ariaLabel,
  selectedKey,
  getSelectedKey,
  onRowClick,
  actionColumnId = "actions",
}: DataTableProps<T>) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId: rowId,
  });
  const isSelected = (row: T) => selectedKey !== undefined && getSelectedKey?.(row) === selectedKey;
  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table
          aria-label={ariaLabel}
          className="table-auto"
          style={{ width: "max-content", minWidth: "100%" }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(header.column.columnDef.meta?.thClassName)}
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
                data-state={isSelected(row.original) ? "selected" : undefined}
                className="cursor-pointer"
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn("min-w-0 py-3", cell.column.columnDef.meta?.tdClassName)}
                    onClick={
                      cell.column.id === actionColumnId
                        ? (event) => event.stopPropagation()
                        : undefined
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
