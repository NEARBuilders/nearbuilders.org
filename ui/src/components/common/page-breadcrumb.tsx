import { Link } from "@tanstack/react-router";

function PageBreadcrumb({
  parentLabel,
  parentTo,
  parentSearch,
  parentParams,
  current,
  currentClassName = "min-w-0 max-w-[180px] truncate text-sm font-semibold text-foreground sm:max-w-[240px]",
}: {
  parentLabel: string;
  parentTo: string;
  parentSearch?: Record<string, unknown>;
  parentParams?: Record<string, string>;
  current: string;
  currentClassName?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
      <Link
        to={parentTo}
        search={parentSearch}
        params={parentParams}
        className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {parentLabel}
      </Link>
      <span aria-hidden="true" className="shrink-0 text-muted-foreground">
        /
      </span>
      <span className={currentClassName}>{current}</span>
    </nav>
  );
}

export { PageBreadcrumb };
