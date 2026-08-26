import { describe, expect, it } from "vitest";
import { getProjectFormValidation } from "./project-form-validation";

describe("project form validation", () => {
  it("reports the required fields missing from an idea", () => {
    const validation = getProjectFormValidation({
      kind: "idea",
      visibility: "public",
    });

    expect(validation.errors).toEqual({
      title: "Title is required",
      content: "Markdown content is required for ideas",
    });
    expect(validation.missingCount).toBe(2);
    expect(validation.invalidFieldCount).toBe(2);
    expect(validation.isValid).toBe(false);
  });

  it.each([
    "idea",
    "scope",
    "result",
  ] as const)("accepts a valid %s with Markdown content", (kind) => {
    const validation = getProjectFormValidation({
      kind,
      title: "Example entry",
      content: "# Details",
      visibility: "public",
    });

    expect(validation).toMatchObject({
      errors: {},
      missingCount: 0,
      invalidFieldCount: 0,
      isValid: true,
    });
  });

  it("accepts a project with a valid repository URL", () => {
    const validation = getProjectFormValidation({
      kind: "project",
      title: "Example project",
      repository: "https://github.com/example/project",
      visibility: "public",
    });

    expect(validation).toMatchObject({
      errors: {},
      missingCount: 0,
      invalidFieldCount: 0,
      isValid: true,
    });
  });

  it("distinguishes invalid populated fields from missing fields", () => {
    const validation = getProjectFormValidation({
      kind: "project",
      title: "Example project",
      repository: "not-a-url",
      description: "x".repeat(1001),
      visibility: "public",
    });

    expect(validation.errors).toEqual({
      description: "Max 1000 characters",
      repository: "Must be a valid URL",
    });
    expect(validation.missingCount).toBe(0);
    expect(validation.invalidFieldCount).toBe(2);
    expect(validation.isValid).toBe(false);
  });
});
