import type { ReactNode } from "react";

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function VoteButton({
  icon,
  onClick,
  label,
  disabled,
  active,
  activeColor,
  size = "default",
}: {
  icon: ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
  activeColor?: string;
  size?: "default" | "compact";
}) {
  return (
    <button
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
      )}
    >
      {icon}
    </button>
  );
}

export { VoteButton };
