import type { ReactNode } from "react";

export function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    // oxlint-disable-next-line shadcn/no-arbitrary-values -- fixed label column beside flexible value; grid-template-columns has no scale equivalent
    <div className="grid grid-cols-[100px_1fr] gap-4 rounded-sm border border-border bg-muted px-3.5 py-2.5 items-center">
      <span className="text-muted-foreground text-2xs font-bold uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-foreground text-13 break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
