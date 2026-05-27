import type * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full border border-border bg-input px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground rounded-md transition-[border-color,box-shadow] focus:outline-none focus:border-ring focus:shadow-[0_0_0_3px_rgba(0,217,163,0.1)] disabled:cursor-not-allowed disabled:bg-secondary disabled:border-border disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
