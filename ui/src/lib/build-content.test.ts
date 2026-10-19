import { describe, expect, it } from "vitest";
import {
  BUILDER_TELEGRAM_URL,
  type BuildTopic,
  buildGetInvolved,
  buildTopics,
  getBuildFooterLinks,
  getBuildGetInvolvedActionHref,
  listBuildTopicLinks,
} from "./build-content";
import { BUILD_PAGE_PATH } from "./site-paths";

function isHttpsUrl(value: string) {
  return new URL(value).protocol === "https:";
}

describe("build topics", () => {
  it("lists Smart Contracts first, then Private Cloud and Agentic Commerce", () => {
    expect(buildTopics.map((topic) => topic.title)).toEqual([
      "Smart Contracts",
      "Private Cloud",
      "Agentic Commerce",
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

  it("gives each topic its own logo", () => {
    expect(buildTopics.map((topic) => topic.logo)).toEqual([
      "near-protocol",
      "near-ai",
      "near-intents",
    ]);
  });

  it("uses tool ids that do not clash with topic ids", () => {
    const ids = buildTopics.flatMap((topic) => [topic.id, ...topic.tools.map((tool) => tool.id)]);
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

  it("includes NEAR AI Cloud access under Private Cloud", () => {
    const privateCloud = buildTopics.find((topic) => topic.id === "private-cloud");
    const cloud = privateCloud?.tools.find((tool) => tool.id === "near-ai-cloud");

    expect(cloud?.links.map((link) => link.href)).toEqual([
      "https://github.com/near/agent-skills/tree/main/skills/near-ai-cloud",
      "https://near.ai/models",
    ]);
    expect(cloud?.access?.apiKey.href).toBe("https://cloud.near.ai");
    expect(cloud?.access?.baseUrl).toBe("https://cloud-api.near.ai/v1");
  });

  it("links Smart Contracts to the contract docs, SDKs, reference contracts and faucet", () => {
    const contracts = buildTopics.find((topic) => topic.id === "smart-contracts");

    expect(contracts?.tools.flatMap((tool) => tool.links.map((link) => link.href))).toEqual([
      "https://docs.near.org/smart-contracts/what-is",
      "https://docs.near.org/tools/sdk",
      "https://docs.near.org/tools/contracts-list",
      "https://near-faucet.io",
    ]);
  });
});

describe("listBuildTopicLinks", () => {
  it("starts with the primary link and includes tool links and the API key link", () => {
    const topic: BuildTopic = {
      id: "agentic-commerce",
      title: "Topic",
      logo: "near-intents",
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

describe("buildGetInvolved", () => {
  it("features the feedback and activity projects first", () => {
    expect(buildGetInvolved.featuredProjectSlugs.slice(0, 2)).toEqual([
      "feedback-nearbuilders-org-ew364z",
      "activity-nearbuilders-org-2erd1k",
    ]);
  });

  it("uses unique featured slugs", () => {
    const slugs = buildGetInvolved.featuredProjectSlugs;
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("links Share a project to the new project form and the builder chat to Telegram", () => {
    expect(buildGetInvolved.actions.map(getBuildGetInvolvedActionHref)).toEqual([
      "/projects/new/project",
      BUILDER_TELEGRAM_URL,
    ]);
  });

  it("gives every action a unique id, label and description", () => {
    const ids = buildGetInvolved.actions.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const action of buildGetInvolved.actions) {
      expect(action.label.trim()).not.toBe("");
      expect(action.description.trim()).not.toBe("");
    }
  });
});
