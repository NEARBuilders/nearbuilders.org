import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/app";
import { ProgramCard } from "@/components/program-card";
import { projectProgramsQueryOptions } from "@/lib/queries/programs";

export function ProjectProgramsSection({ projectId }: { projectId: string }) {
  const apiClient = useApiClient();
  const { data: programs } = useQuery(projectProgramsQueryOptions(apiClient, projectId));

  if (!programs || programs.length === 0) return null;

  return (
    <section className="border-t border-border pt-6">
      <p className="text-xs font-bold uppercase tracking-12 text-brand-accent">Programs</p>
      <h2 className="mt-1 text-xl font-semibold text-foreground">Programs from this project</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {programs.map((program) => (
          <ProgramCard key={program.id} program={program} showProject={false} />
        ))}
      </div>
    </section>
  );
}
