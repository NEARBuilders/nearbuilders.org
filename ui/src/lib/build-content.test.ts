import { describe, expect, it } from "vitest";
import {
  type BuildTopic,
  buildTopics,
  getBuildFooterLinks,
  listBuildTopicLinks,
} from "./build-content";
import { BUILD_PAGE_PATH } from "./site-paths";

function isHttpsUrl(value: string) {
  return new URL(value).protocol === "https:";
}

describe("build topics", () => {
  it("lists Private Cloud, Agentic Commerce and Smart Contracts in order", () => {
    expect(buildTopics.map((topic) => topic.title)).toEqual([
      "Private Cloud",
      "Agentic Commerce",
      "Smart Contracts",
    ]);
  });

  it("gives every topic a title, summary and primary link", () => {
    for (const topic of buildTopics) {
      expect(topic.title.trim()).not.toBe("");
      expect(topic.summary.trim()).not.toBe("");
      expect(topic.primaryLink.label.trim()).not.toBe("");
      expect(isHttpsUrl(topic.primaryLink.href)).toBe(true);
    }
  });

  it("uses unique topic ids", () => {
    const ids = buildTopics.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses https for every topic link", () => {
    for (const topic of buildTopics) {
      for (const link of listBuildTopicLinks(topic)) {
        expect(link.label.trim()).not.toBe("");
        expect(isHttpsUrl(link.href)).toBe(true);
      }
    }
  });

  it("includes Agent Connect access under Agentic Commerce", () => {
    const commerce = buildTopics.find((topic) => topic.id === "agentic-commerce");
    const agentConnect = commerce?.tools.find((tool) => tool.id === "agent-connect");

    expect(agentConnect?.links.length).toBeGreaterThan(0);
    expect(agentConnect?.access?.apiKey.href).toBe("https://partners.demo.agentsonintents.com/");
    expect(agentConnect?.access?.baseUrl).toBe("https://api.demo.agentsonintents.com");
  });
});

describe("listBuildTopicLinks", () => {
  it("starts with the primary link and includes tool links and the API key link", () => {
    const topic: BuildTopic = {
      id: "agentic-commerce",
      title: "Topic",
      summary: "Summary",
      primaryLink: { label: "Docs", href: "https://docs.example.com" },
      links: [{ label: "Extra", href: "https://extra.example.com" }],
      tools: [
        {
          id: "tool",
          name: "Tool",
          summary: "Tool summary",
          links: [{ label: "SDK", href: "https://sdk.example.com" }],
          access: {
            title: "Get access",
            apiKeyStep: "Get a key",
            apiKey: { label: "Key", href: "https://key.example.com" },
            baseUrlStep: "Use the base URL",
            baseUrl: "https://api.example.com",
          },
        },
      ],
    };

    expect(listBuildTopicLinks(topic).map((link) => link.href)).toEqual([
      "https://docs.example.com",
      "https://extra.example.com",
      "https://sdk.example.com",
      "https://key.example.com",
    ]);
  });
});

describe("getBuildFooterLinks", () => {
  it("starts with the build page", () => {
    expect(getBuildFooterLinks()[0]).toEqual({
      kind: "internal",
      label: "Build on NEAR",
      to: BUILD_PAGE_PATH,
    });
  });

  it("includes every topic's primary link", () => {
    const hrefs = getBuildFooterLinks().flatMap((link) =>
      link.kind === "external" ? [link.href] : [],
    );

    for (const topic of buildTopics) {
      expect(hrefs).toContain(topic.primaryLink.href);
    }
  });

  it("ends with Brand", () => {
    expect(getBuildFooterLinks().at(-1)).toEqual({
      kind: "internal",
      label: "Brand",
      to: "/brand",
    });
  });

  it("derives links from the topics it is given", () => {
    const [first] = buildTopics;
    const links = getBuildFooterLinks([first]);

    expect(links).toHaveLength(3);
    expect(links[1]).toEqual({
      kind: "external",
      label: first.primaryLink.label,
      href: first.primaryLink.href,
    });
  });
});
