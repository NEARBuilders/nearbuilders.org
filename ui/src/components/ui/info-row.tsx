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
    <div className="grid grid-cols-[100px_1fr] gap-4 rounded-[8px] border border-border bg-muted px-3.5 py-2.5 items-center">
      <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-foreground text-[13px] break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
