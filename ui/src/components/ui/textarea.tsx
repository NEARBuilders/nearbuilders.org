import type * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // oxlint-disable-next-line shadcn/no-arbitrary-values -- shadcn/ui's standard 3px focus ring and border/shadow transition; not on Tailwind's built-in ring scale (0/1/2/4/8) or named transition utilities
        "flex w-full border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground rounded-md transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-secondary disabled:opacity-70 min-h-20 field-sizing-content aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
