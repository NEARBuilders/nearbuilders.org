import { describe, expect, it } from "vitest";
import { readProjectApprovalActivityPayload } from "../lib/project-activity";

describe("Project approval activity payload", () => {
  it("reads the project snapshot used by historical feeds", () => {
    expect(
      readProjectApprovalActivityPayload({
        projectId: "project-1",
        projectKind: "project",
        projectSlug: "example-project",
        projectTitle: "Example Project",
        projectDescription: "A project description",
        repositoryUrl: "https://github.com/example/project",
      }),
    ).toEqual({
      projectId: "project-1",
      projectKind: "project",
      projectSlug: "example-project",
      projectTitle: "Example Project",
      projectDescription: "A project description",
      repositoryUrl: "https://github.com/example/project",
    });
  });

  it("rejects incomplete snapshots", () => {
    expect(readProjectApprovalActivityPayload({ projectId: "project-1" })).toBeNull();
  });
});
