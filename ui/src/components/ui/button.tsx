import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold cursor-pointer transition-colors duration-150 disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground rounded-xl hover:opacity-90 active:opacity-80 disabled:opacity-50",
        destructive:
          "bg-destructive text-destructive-foreground rounded-xl hover:bg-[#D21B14] active:bg-[#BA1F19] disabled:opacity-50",
        outline:
          "bg-card text-foreground border border-border rounded-xl hover:bg-secondary hover:border-[#D5DCE1] active:bg-accent active:border-[#C5CED6] disabled:opacity-50",
        secondary:
          "bg-secondary text-secondary-foreground border border-border rounded-xl hover:bg-accent hover:border-[#D5DCE1] disabled:opacity-50",
        ghost:
          "bg-transparent text-foreground rounded-xl hover:bg-secondary active:bg-accent disabled:opacity-50",
        link: "bg-transparent text-brand-cyan underline-offset-4 hover:underline disabled:opacity-50",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 px-3 py-1.5 has-[>svg]:px-2.5 text-xs",
        lg: "h-[52px] px-5 py-3 has-[>svg]:px-4 text-base rounded-2xl",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
