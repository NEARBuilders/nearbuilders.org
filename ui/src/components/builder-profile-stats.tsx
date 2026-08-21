import type { BuilderStats } from "@/lib/queries/builders";

const STAT_ITEMS: Array<{
  key: keyof BuilderStats;
  label: string;
  mobileLabel: string;
  featured: boolean;
}> = [
  { key: "projects", label: "Projects", mobileLabel: "Projects", featured: true },
  { key: "ideas", label: "Ideas", mobileLabel: "Ideas", featured: true },
  {
    key: "catalogProjects",
    label: "Catalog projects",
    mobileLabel: "Catalog",
    featured: false,
  },
];

export function BuilderProfileStats({
  stats,
  isLoading,
  isError,
}: {
  stats: BuilderStats | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <section
      aria-label="Builder contribution stats"
      className="mb-8 overflow-hidden rounded-2xl border border-border bg-border"
    >
      <div className="grid grid-cols-3 gap-px">
        {STAT_ITEMS.map(({ key, label, mobileLabel, featured }) => {
          const value = stats?.[key] ?? null;
          const unavailable = isError || value === null;

          return (
            <fieldset
              key={key}
              aria-label={label}
              className="flex min-w-0 flex-col items-center justify-center gap-1 bg-card px-2 py-3 text-center sm:px-3 sm:py-4"
            >
              {isLoading ? (
                <span
                  className={`animate-pulse rounded bg-muted ${featured ? "h-7 w-10" : "h-6 w-8"}`}
                />
              ) : (
                <span
                  className={`font-semibold tabular-nums tracking-tight ${
                    unavailable ? "text-muted-foreground" : "text-foreground"
                  } ${featured ? "text-2xl sm:text-xl" : "text-lg sm:text-xl"}`}
                >
                  {unavailable ? "—" : value}
                </span>
              )}
              <span className="flex min-h-7 items-center justify-center text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
                <span className="sm:hidden">{mobileLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
