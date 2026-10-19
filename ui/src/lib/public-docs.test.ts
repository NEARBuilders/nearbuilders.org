import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildGetInvolved,
  buildTopics,
  getBuildGetInvolvedActionHref,
  listBuildTopicLinks,
} from "./build-content";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");

function readPublicFile(name: string) {
  return readFileSync(resolve(publicDir, name), "utf8");
}

const skill = readPublicFile("skill.md");
const llms = readPublicFile("llms.txt");
const publicReadme = readPublicFile("README.md");

describe("skill.md", () => {
  it("includes every build topic link", () => {
    const hrefs = buildTopics.flatMap((topic) =>
      listBuildTopicLinks(topic).map(({ href }) => href),
    );

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(skill).toContain(href);
    }
  });

  it("includes every tool base URL", () => {
    const baseUrls = buildTopics.flatMap((topic) =>
      topic.tools.flatMap((tool) => (tool.access ? [tool.access.baseUrl] : [])),
    );

    expect(baseUrls).toEqual([
      "https://cloud-api.near.ai/v1",
      "https://api.demo.agentsonintents.com",
    ]);
    for (const baseUrl of baseUrls) {
      expect(skill).toContain(baseUrl);
    }
  });

  it("links to every featured project", () => {
    for (const slug of buildGetInvolved.featuredProjectSlugs) {
      expect(skill).toContain(`https://nearbuilders.org/projects/project/${slug}`);
    }
  });

  it("includes every get involved action", () => {
    for (const action of buildGetInvolved.actions) {
      const href = getBuildGetInvolvedActionHref(action);
      expect(skill).toContain(href.startsWith("/") ? `https://nearbuilders.org${href}` : href);
    }
  });

  it("links to the build and join pages", () => {
    expect(skill).toContain("https://nearbuilders.org/build");
    expect(skill).toContain("https://nearbuilders.org/join");
  });

  it("no longer mentions IronClaw", () => {
    expect(skill).not.toMatch(/ironclaw/i);
  });
});

describe.each([
  ["llms.txt", llms],
  ["README.md", publicReadme],
])("public %s", (_name, content) => {
  it.each(["/build", "/join", "/skill.md"])("links to %s", (path) => {
    expect(content).toContain(`https://nearbuilders.org${path})`);
  });

  it("describes NEAR Builders", () => {
    expect(content).toContain("NEAR Builders");
  });
});
