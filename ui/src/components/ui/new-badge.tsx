import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isNew(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const created = new Date(iso).getTime();
  return !Number.isNaN(created) && Date.now() - created < SEVEN_DAYS_MS;
}

export function NewBadge({
  createdAt,
  compact,
  className,
}: {
  createdAt: string | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (!isNew(createdAt)) return null;

  return (
    <Badge
      variant="success"
      title="Added in the last 7 days"
      className={cn(
        "uppercase tracking-wide",
        compact ? "gap-0.5 px-1.5 py-0 text-[10px]" : "gap-1 px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      New
    </Badge>
  );
}
