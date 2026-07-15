import { z } from "zod";

export const ProjectApprovalActivityPayloadSchema = z.object({
  projectId: z.string(),
  projectKind: z.enum(["project", "idea", "scope", "result"]),
  projectSlug: z.string(),
  projectTitle: z.string(),
  projectDescription: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
});

export type ProjectApprovalActivityPayload = z.infer<typeof ProjectApprovalActivityPayloadSchema>;

export function readProjectApprovalActivityPayload(
  payload: unknown,
): ProjectApprovalActivityPayload | null {
  const result = ProjectApprovalActivityPayloadSchema.safeParse(payload);
  return result.success ? result.data : null;
}
