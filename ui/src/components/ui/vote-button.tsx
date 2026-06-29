import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type VoteButtonProps = React.ComponentProps<"button"> & {
  icon: ReactNode;
  label: string;
  active?: boolean;
  activeColor?: string;
  size?: "default" | "compact";
};

const VoteButton = forwardRef<HTMLButtonElement, VoteButtonProps>(function VoteButton(
  { icon, onClick, label, disabled, active, activeColor, size = "default", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex items-center justify-center transition-all duration-[120ms] border border-transparent [webkit-tap-highlight-color:transparent]",
        size === "compact" ? "size-7 rounded-md" : "size-10 rounded-lg",
        disabled
          ? "text-muted-foreground/40 cursor-not-allowed bg-transparent"
          : active
            ? `${activeColor ?? "text-brand-accent"} bg-card shadow-sm cursor-pointer`
            : "text-muted-foreground bg-transparent hover:bg-muted hover:text-foreground cursor-pointer",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});

export { VoteButton };
