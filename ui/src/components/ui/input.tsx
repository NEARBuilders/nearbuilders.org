import type * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // oxlint-disable-next-line shadcn/no-arbitrary-values -- shadcn/ui's standard 3px focus ring and border/shadow transition; Tailwind's built-in ring scale (0/1/2/4/8) and named transition utilities don't cover this combination
        "flex h-10 w-full border border-border bg-input px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground rounded-md transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-secondary disabled:border-border disabled:opacity-70 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
