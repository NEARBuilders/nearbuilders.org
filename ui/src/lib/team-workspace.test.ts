import { describe, expect, it } from "vitest";
import { areaForPath, isPathAllowed, type TeamWorkspace } from "./team-workspace";

function workspace(overrides?: Partial<TeamWorkspace>): TeamWorkspace {
  return {
    teams: [],
    activeTeam: null,
    allowedAreas: null,
    canManageOrganization: false,
    ...overrides,
  };
}

describe("team workspace area gating", () => {
  it("maps the projects area by path", () => {
    expect(areaForPath("/projects/new")).toBe("projects");
    expect(areaForPath("/projects/new/idea")).toBe("projects");
    expect(areaForPath("/projects/idea/my-slug/edit")).toBe("projects");
  });

  it("leaves non-authoring project paths un-gated", () => {
    expect(areaForPath("/projects")).toBeNull();
    expect(areaForPath("/projects/idea/my-slug")).toBeNull();
  });

  it("keeps the organizations area", () => {
    expect(areaForPath("/organizations")).toBe("organizations");
    expect(areaForPath("/organizations/new")).toBe("organizations");
  });

  it("allows everything when the active team does not restrict areas", () => {
    const unrestricted = workspace();
    expect(isPathAllowed(unrestricted, "/projects/new")).toBe(true);
  });

  it("gates restricts when the active team lacks the area", () => {
    const restricted = workspace({
      activeTeam: { id: "t1", name: "Guest", areas: ["organizations"], permissions: {} },
      allowedAreas: ["organizations"],
    });
    expect(isPathAllowed(restricted, "/projects/new")).toBe(false);
    expect(isPathAllowed(restricted, "/projects/idea/my-slug/edit")).toBe(false);
    expect(isPathAllowed(restricted, "/projects")).toBe(true);
  });
});
