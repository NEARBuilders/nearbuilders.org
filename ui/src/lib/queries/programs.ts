import type { ApiClient } from "@/app";
import type { BuildTopicId } from "@/lib/build-content";

type ProgramsApiClient = {
  projects: Pick<ApiClient["projects"], "listPrograms" | "getProjectPrograms">;
};

export type Program = Awaited<ReturnType<ApiClient["projects"]["listPrograms"]>>["data"][number];

export type ProgramType = Program["type"];

export const programKeys = {
  all: ["programs"] as const,
  list: () => ["programs", "list"] as const,
  project: (projectId: string) => ["programs", "project", projectId] as const,
};

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  credits: "Credits",
  grant: "Grant",
  bounty: "Bounty",
  "api-access": "API access",
  accelerator: "Accelerator",
  hackathon: "Hackathon",
};

type ProgramWindow = Pick<Program, "opensAt" | "closesAt">;

export function isProgramOpen(program: ProgramWindow, now: Date = new Date()): boolean {
  const time = now.getTime();
  if (program.opensAt && new Date(program.opensAt).getTime() > time) return false;
  if (program.closesAt && new Date(program.closesAt).getTime() <= time) return false;
  return true;
}

export function openPrograms<T extends ProgramWindow>(programs: readonly T[], now = new Date()) {
  return programs.filter((program) => isProgramOpen(program, now));
}

export function programsForTopic<T extends Pick<Program, "topicId">>(
  programs: readonly T[],
  topicId: BuildTopicId,
) {
  return programs.filter((program) => program.topicId === topicId);
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function programDateLabel(program: ProgramWindow, now = new Date()) {
  if (!isProgramOpen(program, now) && program.closesAt && new Date(program.closesAt) <= now) {
    return "Closed";
  }
  if (!program.closesAt) return "Rolling";
  return `Closes ${dateFormatter.format(new Date(program.closesAt))}`;
}

export function isInternalProgramUrl(url: string) {
  return url.startsWith("/") && !url.startsWith("//");
}

export function programsQueryOptions(apiClient: ProgramsApiClient) {
  return {
    queryKey: programKeys.list(),
    queryFn: async () => (await apiClient.projects.listPrograms({})).data,
    staleTime: 5 * 60_000,
  };
}

export function projectProgramsQueryOptions(apiClient: ProgramsApiClient, projectId: string) {
  return {
    queryKey: programKeys.project(projectId),
    queryFn: async () => (await apiClient.projects.getProjectPrograms({ projectId })).data,
    staleTime: 5 * 60_000,
  };
}
