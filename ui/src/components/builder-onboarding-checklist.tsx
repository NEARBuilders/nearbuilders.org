import { Link } from "@tanstack/react-router";
import type { Profile } from "better-near-auth";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { getBuilderOnboardingProgress } from "@/lib/builder-onboarding";
import { mergeSocialLinks } from "@/lib/social-links";
import { cn } from "@/lib/utils";

interface BuilderOnboardingProfile {
  bio: string | null;
  links: Record<string, string> | null;
}

type ChecklistTarget =
  | { kind: "near-social" }
  | { kind: "builder-edit"; accountId: string }
  | { kind: "builder-add" }
  | { kind: "idea" };

interface ChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  target: ChecklistTarget;
}

export function BuilderOnboardingChecklist({
  accountId,
  nearProfile,
  builderProfile,
  hasFirstIdea,
  isLoading,
}: {
  accountId: string;
  nearProfile: Profile | null | undefined;
  builderProfile: BuilderOnboardingProfile | null;
  hasFirstIdea: boolean;
  isLoading: boolean;
}) {
  const items = useMemo<ChecklistItem[]>(() => {
    const links = mergeSocialLinks(nearProfile?.linktree, builderProfile?.links);
    const builderTarget: ChecklistTarget = builderProfile
      ? { kind: "builder-edit", accountId }
      : { kind: "builder-add" };

    return [
      {
        id: "avatar",
        label: "Add avatar",
        complete: Boolean(nearProfile?.image?.url || nearProfile?.image?.ipfs_cid),
        target: { kind: "near-social" },
      },
      {
        id: "bio",
        label: "Write bio",
        complete: Boolean(builderProfile?.bio?.trim() || nearProfile?.description?.trim()),
        target: builderTarget,
      },
      {
        id: "github",
        label: "Link GitHub",
        complete: Boolean(links.github),
        target: builderTarget,
      },
      {
        id: "socials",
        label: "Add socials",
        complete: Object.keys(links).some((key) => key !== "github"),
        target: builderTarget,
      },
      {
        id: "first-idea",
        label: "Submit first idea",
        complete: hasFirstIdea,
        target: { kind: "idea" },
      },
    ];
  }, [accountId, builderProfile, hasFirstIdea, nearProfile]);

  const progress = getBuilderOnboardingProgress(items.map((item) => item.complete));
  const nextItemId = items.find((item) => !item.complete)?.id;
  const progressRadius = 20;
  const progressCircumference = 2 * Math.PI * progressRadius;
  const progressOffset = progressCircumference - (progressCircumference * progress) / 100;
  const contentId = useId();
  const [isOpen, setIsOpen] = useState(progress < 100);

  useEffect(() => {
    if (progress === 100) setIsOpen(false);
  }, [progress]);

  if (isLoading) {
    return (
      <section
        className="rounded-2xl border border-brand-accent-border bg-card p-4 shadow-sm sm:p-5"
        aria-busy="true"
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="mt-4 h-2 animate-pulse rounded-full bg-muted" />
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-accent-border bg-card shadow-sm">
      <button
        type="button"
        className="flex w-full items-center gap-3.5 bg-brand-accent-light px-4 py-4 text-left transition-colors hover:bg-brand-accent-light/80 sm:px-5"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <div className="relative h-12 w-12 shrink-0" aria-hidden="true">
          <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
            <title>Profile completion: {progress}%</title>
            <circle
              className="fill-none stroke-muted"
              cx="24"
              cy="24"
              r={progressRadius}
              strokeWidth="4"
            />
            <circle
              className="fill-none stroke-brand-accent transition-[stroke-dashoffset] duration-300"
              cx="24"
              cy="24"
              r={progressRadius}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={progressCircumference}
              strokeDashoffset={progressOffset}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-foreground">
            {progress}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-5 text-foreground">
            {progress === 100 ? "Profile complete" : "Complete your builder profile"}
          </h2>
          <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
            {progress === 100
              ? "Your profile is ready to share"
              : `${items.filter((item) => item.complete).length} of ${items.length} steps complete`}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        className="sr-only"
        role="progressbar"
        aria-label="Builder profile completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`${progress}% complete`}
      />

      {isOpen && (
        <div id={contentId} className="border-t border-border px-4 pb-4 pt-4 sm:px-5">
          <ol className="space-y-1.5">
            {items.map((item, index) => (
              <li key={item.id} className="relative">
                <ChecklistLink
                  target={item.target}
                  complete={item.complete}
                  isNext={item.id === nextItemId}
                >
                  <span
                    className={cn(
                      "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                      item.complete
                        ? "border-brand-accent bg-brand-accent text-brand-mint-foreground"
                        : "border-border bg-card text-transparent",
                    )}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium",
                      item.complete ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                  {item.id === nextItemId && !item.complete && (
                    <span className="rounded-full bg-brand-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-mint-foreground">
                      Next
                    </span>
                  )}
                  {!item.complete && (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </ChecklistLink>
                {index < items.length - 1 && (
                  <span
                    className={cn(
                      "absolute left-[22px] top-5 h-[calc(100%+0.375rem)] w-px",
                      item.complete ? "bg-brand-accent" : "bg-border",
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function ChecklistLink({
  target,
  children,
  complete,
  isNext,
}: {
  target: ChecklistTarget;
  children: ReactNode;
  complete: boolean;
  isNext: boolean;
}) {
  const className = cn(
    "relative flex h-10 items-center gap-2.5 rounded-lg border px-3 py-2",
    !complete && "transition-colors hover:border-border-strong hover:bg-secondary",
  );
  const stateClass = isNext
    ? "border-brand-accent bg-brand-accent-light"
    : complete
      ? "border-transparent bg-muted/40"
      : "border-border bg-background";
  const linkClassName = cn(className, stateClass);

  if (complete) {
    return <div className={linkClassName}>{children}</div>;
  }

  if (target.kind === "near-social") {
    return (
      <a
        href="https://near.social/#/mob.near/widget/ProfileEditor"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        {children}
      </a>
    );
  }

  if (target.kind === "builder-edit") {
    return (
      <Link
        to="/builders/$account/edit"
        params={{ account: target.accountId }}
        className={linkClassName}
      >
        {children}
      </Link>
    );
  }

  if (target.kind === "builder-add") {
    return (
      <Link to="/builders/add" className={linkClassName}>
        {children}
      </Link>
    );
  }

  return (
    <Link
      to="/projects/new/$kind"
      params={{ kind: "idea" }}
      search={{ tab: "write" }}
      className={linkClassName}
    >
      {children}
    </Link>
  );
}
