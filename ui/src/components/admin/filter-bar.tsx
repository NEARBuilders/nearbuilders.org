import { Download, Loader2, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedFilter } from "@/components/ui/segmented-filter";

type FilterOption<V extends string> = { value: V; label: string };

type FilterBarSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
};

type FilterBarFilters<V extends string> = {
  options: ReadonlyArray<FilterOption<V>>;
  value: V;
  onChange: (value: V) => void;
  ariaLabel: string;
};

type FilterBarExportAction = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
};

export type FilterBarProps<V extends string = string> = {
  title?: string;
  subtitle: ReactNode;
  search: FilterBarSearch;
  filters: FilterBarFilters<V>;
  exportAction: FilterBarExportAction;
};

export function FilterBar<V extends string>({
  title,
  subtitle,
  search,
  filters,
  exportAction,
}: FilterBarProps<V>) {
  const exportLabel = exportAction.label ?? "Export CSV";
  const exportDisabled = exportAction.disabled ?? exportAction.loading ?? false;
  return (
    <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {title ? <h2 className="text-xl font-bold text-foreground">{title}</h2> : null}
        <p className={`text-sm text-muted-foreground${title ? " mt-1" : ""}`}>{subtitle}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.ariaLabel}
            className="h-10 pl-8 sm:h-8"
          />
        </div>
        <div className="max-w-full overflow-x-auto pb-1 [&_button]:h-9 sm:pb-0 sm:[&_button]:h-7">
          <SegmentedFilter
            options={filters.options as Array<{ value: V; label: string }>}
            value={filters.value}
            onChange={filters.onChange}
            ariaLabel={filters.ariaLabel}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-10 sm:h-8"
          disabled={exportDisabled}
          onClick={exportAction.onClick}
        >
          {exportAction.loading ? <Loader2 className="animate-spin" /> : <Download />}
          {exportLabel}
        </Button>
      </div>
    </div>
  );
}
