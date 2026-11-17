import { Activity, ChevronDown, ExternalLink, MessageSquare, Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  type ActivityProject,
  RegisterActivityDialog,
  useActivityEligibility,
  useProjectActivity,
} from "@/components/project-activity";
import { useProjectFeedback } from "@/components/project-feedback";
import { Button } from "@/components/ui/button";
import { activityIntegrationGuideUrl } from "@/lib/activity-agent-prompt";
import { cn } from "@/lib/utils";

type NextStepsProject = ActivityProject & { slug: string };

type StepRow = {
  done: boolean;
  summary: string;
  body: string;
  action: ReactNode;
};

function formatRoundEnd(endsAt: string) {
  return new Date(endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function pluralRounds(count: number) {
  return count === 1 ? "1 past round" : `${count} past rounds`;
}

function linkAction(href: string, label: string) {
  return (
    <Button asChild size="sm" variant="outline" className="w-fit">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
        <ExternalLink size={12} className="text-muted-foreground" />
      </a>
    </Button>
  );
}

function useFeedbackRow(projectId: string): StepRow | null {
  const { data, isLoading } = useProjectFeedback(projectId);
  if (isLoading) return null;
  if (data?.status === "open" && data.openRound) {
    const { number, endsAt, url } = data.openRound;
    return {
      done: true,
      summary: "Round open",
      body: endsAt
        ? `Round ${number} open until ${formatRoundEnd(endsAt)}`
        : `Round ${number} is open`,
      action: linkAction(url, "View round"),
    };
  }
  if (data?.status === "registered") {
    return {
      done: true,
      summary: "On Feedback",
      body: data.pastRounds > 0 ? pluralRounds(data.pastRounds) : "Approved on Feedback",
      action: linkAction(data.requestUrl, "Start a new round"),
    };
  }
  return {
    done: false,
    summary: "No feedback yet",
    body: "Get feedback from other builders",
    action: data ? linkAction(data.requestUrl, "Request feedback") : null,
  };
}

function useActivityRow(
  project: NextStepsProject,
  isOwner: boolean,
  openRegister: () => void,
): StepRow | null {
  const { data, isLoading, isError } = useProjectActivity(project.id);
  const eligibility = useActivityEligibility(project, isOwner);
  if (isLoading) return null;
  if (isError || !data) {
    return {
      done: false,
      summary: "Activity",
      body: "Activity status is unavailable right now",
      action: null,
    };
  }
  const sourceUrl = new URL("/activity", data.activityUrl);
  if (data.sourceId) sourceUrl.searchParams.set("source", data.sourceId);
  if (data.status === "tracked") {
    return {
      done: true,
      summary: "Activity tracked",
      body: "Activity tracked",
      action: linkAction(sourceUrl.toString(), "View activity"),
    };
  }
  if (data.status === "connected") {
    return {
      done: true,
      summary: "Activity connected",
      body: "Connected, waiting for the first event",
      action: linkAction(activityIntegrationGuideUrl(data.activityUrl), "Integration guide"),
    };
  }
  if (data.status === "rejected") {
    return {
      done: false,
      summary: "Activity rejected",
      body: data.reviewReason ?? "An Activity administrator rejected this project's connection.",
      action: linkAction(sourceUrl.toString(), "Fix on Activity"),
    };
  }
  if (!isOwner) {
    return {
      done: false,
      summary: "Not on Activity",
      body: "Only the project owner can register Activity",
      action: null,
    };
  }
  if (!eligibility.ready) return null;
  if (!eligibility.eligible) {
    return {
      done: false,
      summary: "Not on Activity",
      body: eligibility.reason ?? "Available once your project is approved",
      action: null,
    };
  }
  return {
    done: false,
    summary: "Not on Activity",
    body: "Reward people who use your app",
    action: (
      <Button type="button" size="sm" variant="outline" className="w-fit" onClick={openRegister}>
        Register Activity
      </Button>
    ),
  };
}

function StepBadge({ icon, label, done }: { icon: ReactNode; label: string; done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        done
          ? "border-brand-accent-border bg-brand-accent-light text-foreground"
          : "border-border text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function StepRowView({
  icon,
  title,
  row,
}: {
  icon: ReactNode;
  title: string;
  row: StepRow | null;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{row ? row.body : "Checking…"}</p>
        </div>
      </div>
      {row?.action && <div className="shrink-0 pl-7 sm:pl-0">{row.action}</div>}
    </div>
  );
}

export function ProjectNextSteps({
  project,
  isOwner,
  visible,
  fresh,
}: {
  project: NextStepsProject;
  isOwner: boolean;
  visible: boolean;
  fresh: boolean;
}) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
  const feedback = useFeedbackRow(project.id);
  const activity = useActivityRow(project, isOwner, () => setRegisterOpen(true));
  const activityUrl = useProjectActivity(project.id).data?.activityUrl;

  if (!visible || project.kind !== "project") return null;

  const allDone = Boolean(feedback?.done && activity?.done);
  const expanded = expandedOverride ?? (fresh || !allDone);
  const feedbackIcon = <MessageSquare className="size-4" />;
  const activityIcon = <Activity className="size-4" />;

  return (
    <section
      aria-label="Next steps"
      data-testid="project-next-steps"
      className="rounded-xl border border-border bg-muted/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-brand-accent" />
          <p className="font-semibold text-foreground">
            {fresh ? "Your project is live. Next:" : "Next steps"}
          </p>
        </div>
        {allDone && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={expanded}
            onClick={() => setExpandedOverride(!expanded)}
          >
            {expanded ? "Hide" : "Show"}
            <ChevronDown
              size={14}
              className={cn("transition-transform", expanded && "rotate-180")}
            />
          </Button>
        )}
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <StepRowView icon={feedbackIcon} title="Feedback" row={feedback} />
          <StepRowView icon={activityIcon} title="Activity" row={activity} />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {feedback && (
            <StepBadge icon={feedbackIcon} label={feedback.summary} done={feedback.done} />
          )}
          {activity && (
            <StepBadge icon={activityIcon} label={activity.summary} done={activity.done} />
          )}
        </div>
      )}

      {isOwner && activityUrl && (
        <RegisterActivityDialog
          projectId={project.id}
          projectSlug={project.slug}
          activityUrl={activityUrl}
          open={registerOpen}
          onOpenChange={setRegisterOpen}
        />
      )}
    </section>
  );
}
