import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { useClientValue } from "@/hooks";
import { buildPage } from "@/lib/build-content";
import { BUILD_PAGE_PATH } from "@/lib/site-paths";
import { cn } from "@/lib/utils";

const BUILD_BANNER_STORAGE_KEY = "nearbuilders:build-banner-dismissed";

export function BuildBanner({ className }: { className?: string }) {
  const dismissedBefore = useClientValue(
    () => localStorage.getItem(BUILD_BANNER_STORAGE_KEY) === "1",
    true,
  );
  const [dismissed, setDismissed] = useState(false);

  if (dismissedBefore || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(BUILD_BANNER_STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <aside
      className={cn(
        "flex items-center gap-3 rounded-xl border border-brand-accent-border bg-brand-accent-light py-2.5 pl-4 pr-2 text-sm",
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-foreground">
        <span className="font-semibold">{buildPage.banner.title}</span>
        <span className="hidden text-muted-foreground sm:inline">
          {" "}
          · {buildPage.banner.description}
        </span>
      </p>
      <Link
        to={BUILD_PAGE_PATH}
        className="group inline-flex shrink-0 items-center gap-1 font-semibold text-foreground transition-colors hover:text-brand-accent"
      >
        {buildPage.banner.action}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </aside>
  );
}
