import { useQuery } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";
import { useApiClient } from "@/app";

export function ProjectReviewStatus({
  projectId,
  visible,
}: {
  projectId: string;
  visible: boolean;
}) {
  const apiClient = useApiClient();
  const proposalQuery = useQuery({
    queryKey: ["project-proposal", projectId],
    queryFn: () =>
      apiClient.getProposals({
        pluginId: "projects",
        entityId: projectId,
        limit: 1,
      }),
    enabled: visible,
  });
  const proposal = proposalQuery.data?.data[0];

  if (!visible || proposal?.reviewStatus !== "pending") return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-accent bg-brand-accent-light p-4">
      <Clock3 className="mt-0.5 size-5 shrink-0 text-brand-accent" />
      <div>
        <p className="font-semibold text-foreground">Pending approval</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This project is awaiting admin review and will remain private until it is approved.
        </p>
      </div>
    </div>
  );
}
