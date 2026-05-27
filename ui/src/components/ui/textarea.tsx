import type * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground rounded-md transition-[border-color,box-shadow] focus:outline-none focus:border-ring focus:shadow-[0_0_0_3px_rgba(0,217,163,0.1)] disabled:cursor-not-allowed disabled:bg-secondary disabled:opacity-70 min-h-[80px] field-sizing-content",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
