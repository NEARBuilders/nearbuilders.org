import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { EventTab, TimelineEvent } from "./-event-sources";

export type EventDayGroupData = {
  key: string;
  primaryLabel: string;
  secondaryLabel: string;
  events: TimelineEvent[];
};

export function EventDayGroup({
  group,
  tab,
  children,
}: {
  group: EventDayGroupData;
  tab: EventTab;
  children: ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsPinned(!entry.isIntersecting && entry.boundingClientRect.top < 76);
      },
      { rootMargin: "-76px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative pb-7 last:pb-0">
      <div ref={sentinelRef} className="absolute top-0 h-px w-px" aria-hidden />
      <div className="absolute bottom-0 left-1.5 top-4 w-px bg-border" aria-hidden />
      <span
        className={cn(
          "absolute left-0 top-4 z-10 size-3 rounded-full border-2 border-background",
          tab === "past" ? "bg-muted-foreground/50" : "bg-brand-accent",
        )}
      />

      <div className="sticky top-[76px] z-20 mb-3 ml-6 h-8">
        <h2
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-1 text-sm transition-all duration-150",
            isPinned &&
              "border border-border bg-background/80 px-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70",
          )}
        >
          <span className="font-bold text-foreground">{group.primaryLabel}</span>
          <span className="text-muted-foreground">{group.secondaryLabel}</span>
        </h2>
      </div>

      <div className="ml-6 space-y-3">{children}</div>
    </section>
  );
}
