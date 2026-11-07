import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useApiClient } from "@/app";
import { Button } from "@/components/ui/button";

export function useProjectFeedback(projectId: string, enabled = true) {
  const apiClient = useApiClient();
  return useQuery({
    queryKey: ["project-feedback", projectId],
    queryFn: () => apiClient.getProjectFeedback({ projectId }),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

export function ProjectFeedbackBadge({ projectId }: { projectId: string }) {
  const { data } = useProjectFeedback(projectId);
  if (data?.status !== "open" && data?.status !== "registered") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-3xs font-semibold text-muted-foreground">
      <MessageSquare className="h-3 w-3" />
      {data.status === "open" ? "Round open" : "Feedback"}
    </span>
  );
}

function feedbackLink(href: string, label: string) {
  return (
    <Button asChild size="sm" variant="outline">
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <MessageSquare size={13} />
        <span className="hidden sm:inline">{label}</span>
      </a>
    </Button>
  );
}

export function ProjectFeedbackAction({
  projectId,
  canManage,
  fallbackRequestUrl,
}: {
  projectId: string;
  canManage: boolean;
  fallbackRequestUrl: string | null;
}) {
  const { data } = useProjectFeedback(projectId);

  if (!canManage) {
    if (data?.status !== "open" || !data.openRound) return null;
    return feedbackLink(data.openRound.url, "Give feedback");
  }

  if (!data) {
    return fallbackRequestUrl ? feedbackLink(fallbackRequestUrl, "Request feedback") : null;
  }
  if (data.status === "open" && data.openRound)
    return feedbackLink(data.openRound.url, "View round");
  if (data.status === "registered") return feedbackLink(data.requestUrl, "Start a new round");
  return feedbackLink(data.requestUrl, "Request feedback");
}
