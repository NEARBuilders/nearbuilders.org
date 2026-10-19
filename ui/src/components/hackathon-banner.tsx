import { ArrowUpRight, X } from "lucide-react";
import { useState } from "react";
import { useClientValue } from "@/hooks";

const HACKATHON_BANNER_STORAGE_KEY = "nearbuilders:hackathon-banner-dismissed";
const HACKATHON_URL = "https://nearhackathon.com/";

export function HackathonBanner() {
  const dismissedBefore = useClientValue(
    () => localStorage.getItem(HACKATHON_BANNER_STORAGE_KEY) === "1",
    true,
  );
  const [dismissed, setDismissed] = useState(false);

  if (dismissedBefore || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(HACKATHON_BANNER_STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <aside className="relative w-full border-b border-hackathon-line bg-hackathon font-hackathon text-xs font-medium text-hackathon-foreground">
      <a
        href={HACKATHON_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group mx-auto flex max-w-7xl items-center justify-center gap-3 py-2 pl-4 pr-12 sm:gap-4 sm:px-12"
      >
        <span className="hidden min-w-0 truncate text-hackathon-muted lg:inline">
          The era of <span className="font-semibold text-hackathon-spot">programmable money</span>{" "}
          starts here...
        </span>
        <span className="hidden shrink-0 text-base leading-none text-hackathon-spot lg:inline">
          ✳
        </span>
        <span className="min-w-0 truncate uppercase">
          <span className="font-semibold">NEAR Hackathon</span>
          <span className="hidden text-hackathon-muted sm:inline"> accepting submissions</span>
          <span className="text-hackathon-muted"> Nov 1</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 bg-hackathon-spot px-3 py-1.5 text-hackathon-on-spot transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
          Read more
          <ArrowUpRight className="size-3.5" />
        </span>
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss hackathon banner"
        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-hackathon-muted transition-colors hover:text-hackathon-foreground"
      >
        <X className="size-4" />
      </button>
    </aside>
  );
}
