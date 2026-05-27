import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const backButtonClass =
  "flex items-center justify-center h-9 w-9 shrink-0 rounded-[10px] border-2 border-outset border-border-strong bg-card shadow-sm transition-all duration-200 ease-out hover:bg-muted hover:shadow-md text-foreground";

function BackButton({
  onClick,
  ariaLabel = "Go back",
}: {
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={backButtonClass}>
      <ArrowLeft size={14} className="text-foreground" />
    </button>
  );
}

function BackLink({
  to,
  search,
  params,
  ariaLabel = "Go back",
}: {
  to: string;
  search?: Record<string, unknown>;
  params?: Record<string, string>;
  ariaLabel?: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      params={params}
      aria-label={ariaLabel}
      className={backButtonClass}
    >
      <ArrowLeft size={14} className="text-foreground" />
    </Link>
  );
}

export { BackButton, BackLink, backButtonClass };
