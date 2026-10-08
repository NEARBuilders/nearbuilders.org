import { describe, expect, it } from "vitest";
import {
  filterProjectFormValidation,
  getProjectFormValidation,
  normalizeDomain,
} from "./project-form-validation";

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
      domain: "app.example.com",
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
      domain: "app.example.com",
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

  it("reports only the fields the user has visited", () => {
    const validation = filterProjectFormValidation(
      getProjectFormValidation({ kind: "idea", visibility: "public" }),
      (field) => field === "title",
    );

    expect(validation.errors).toEqual({ title: "Title is required" });
    expect(validation.missingFields).toEqual(["Title"]);
    expect(validation.invalidFieldCount).toBe(1);
  });

  it("requires a hostname for projects and keeps the host from a pasted URL", () => {
    const missing = getProjectFormValidation({
      kind: "project",
      title: "Example project",
      repository: "https://github.com/example/project",
      visibility: "public",
    });
    expect(missing.errors.domain).toBe("Product URL is required for projects");
    expect(missing.missingFieldKeys).toContain("domain");

    const scheme = getProjectFormValidation({
      kind: "project",
      title: "Example project",
      repository: "https://github.com/example/project",
      domain: "https://app.example.com/start",
      visibility: "public",
    });
    expect(scheme.errors.domain).toBeUndefined();
    expect(scheme.isValid).toBe(true);
    expect(normalizeDomain("https://app.example.com/start")).toBe("app.example.com");
    expect(normalizeDomain("http://app.example.com")).toBe("app.example.com");
    expect(normalizeDomain("app.example.com/docs")).toBe("app.example.com");
    expect(normalizeDomain("app.example.com")).toBe("app.example.com");
  });

  it("keeps domain optional for ideas and validates logo URLs", () => {
    const idea = getProjectFormValidation({
      kind: "idea",
      title: "Example idea",
      content: "# Details",
      visibility: "public",
    });
    expect(idea.errors.domain).toBeUndefined();
    expect(idea.isValid).toBe(true);

    const logo = getProjectFormValidation({
      kind: "idea",
      title: "Example idea",
      content: "# Details",
      logoUrl: "ftp://example.com/logo.png",
      visibility: "public",
    });
    expect(logo.errors.logoUrl).toBe("Logo URL must be an absolute http(s) URL");
  });
});
