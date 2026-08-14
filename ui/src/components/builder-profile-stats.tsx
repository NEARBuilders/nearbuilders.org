import type { BuilderStats } from "@/lib/queries/builders";

const STAT_ITEMS: Array<{ key: keyof BuilderStats; label: string }> = [
  { key: "projects", label: "Projects" },
  { key: "ideas", label: "Ideas" },
  { key: "feedbackRounds", label: "Feedback rounds tested" },
  { key: "githubIssues", label: "GitHub issues filed" },
  { key: "collaborations", label: "Collaborations joined" },
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
      className="mb-8 overflow-hidden rounded-xl border border-border bg-border"
    >
      <div className="grid grid-cols-2 gap-px sm:grid-cols-5">
        {STAT_ITEMS.map(({ key, label }) => (
          <div
            key={key}
            className="flex min-w-0 flex-col items-center justify-center gap-1 bg-card px-3 py-3 text-center last:col-span-2 sm:py-4 sm:last:col-span-1"
          >
            {isLoading ? (
              <span className="h-6 w-8 animate-pulse rounded bg-muted" />
            ) : (
              <span
                className={
                  isError
                    ? "text-xl font-semibold tracking-tight text-muted-foreground"
                    : "text-xl font-semibold tabular-nums tracking-tight text-foreground"
                }
              >
                {isError ? "—" : (stats?.[key] ?? 0)}
              </span>
            )}
            <span className="flex min-h-7 items-center justify-center text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
