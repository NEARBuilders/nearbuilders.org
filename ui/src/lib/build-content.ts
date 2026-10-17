import { BUILD_PAGE_PATH, JOIN_PATH } from "./site-paths";

export type BuildLink = {
  label: string;
  href: string;
};

export type BuildAccess = {
  title: string;
  apiKeyStep: string;
  apiKey: BuildLink;
  baseUrlStep: string;
  baseUrl: string;
};

export type BuildTool = {
  id: string;
  name: string;
  summary: string;
  links: BuildLink[];
  access?: BuildAccess;
};

export type BuildTopicId = "private-cloud" | "agentic-commerce" | "smart-contracts";

export type BuildTopic = {
  id: BuildTopicId;
  title: string;
  summary: string;
  primaryLink: BuildLink;
  links: BuildLink[];
  tools: BuildTool[];
};

export type BuildFooterLink =
  | { kind: "internal"; label: string; to: typeof BUILD_PAGE_PATH | "/brand" }
  | { kind: "external"; label: string; href: string };

export const buildPage = {
  label: "Build on NEAR",
  navLabel: "Build",
  cardTagline: "Topics and docs to start",
  eyebrow: "Build on NEAR",
  title: "Start building on NEAR",
  description:
    "Pick a topic, open the docs, and start shipping. Kept current by the builder community, so hackathons and partners can link here instead of keeping their own lists.",
  metaTitle: "Build on NEAR | NEAR Builders",
  metaDescription:
    "Where to start building on NEAR: Private Cloud, Agentic Commerce and Smart Contracts, with the docs and tools for each.",
  joinAction: { label: "Join NEAR Builders", to: JOIN_PATH },
  browseAction: { label: "Browse projects", to: "/projects" },
} as const;

export const buildTopics: BuildTopic[] = [
  {
    id: "private-cloud",
    title: "Private Cloud",
    summary: "Run AI models and agents on private, verifiable compute with NEAR AI.",
    primaryLink: { label: "NEAR AI Docs", href: "https://docs.near.ai" },
    links: [],
    tools: [],
  },
  {
    id: "agentic-commerce",
    title: "Agentic Commerce",
    summary: "Let agents swap, pay and settle across chains through NEAR Intents.",
    primaryLink: { label: "NEAR Intents Docs", href: "https://docs.near-intents.org" },
    links: [],
    tools: [
      {
        id: "agent-connect",
        name: "Agent Connect",
        summary:
          "Give an AI agent its own account on NEAR Intents, acting within rules its owner signs.",
        links: [
          { label: "Agent skill", href: "https://github.com/NEAR-Intents-Agent-API/skills" },
          {
            label: "TypeScript SDK",
            href: "https://github.com/NEAR-Intents-Agent-API/sdk-typescript",
          },
          { label: "Demo app", href: "https://github.com/NEAR-Intents-Agent-API/demo" },
          { label: "Examples", href: "https://github.com/NEAR-Intents-Agent-API/examples" },
        ],
        access: {
          title: "Get access",
          apiKeyStep: "Get an API key from the partner portal.",
          apiKey: {
            label: "Get an API key",
            href: "https://partners.demo.agentsonintents.com/",
          },
          baseUrlStep: "Point your agent at the base URL.",
          baseUrl: "https://api.demo.agentsonintents.com",
        },
      },
    ],
  },
  {
    id: "smart-contracts",
    title: "Smart Contracts",
    summary: "Write, test and deploy contracts and apps on NEAR Protocol.",
    primaryLink: { label: "NEAR Docs", href: "https://docs.near.org" },
    links: [],
    tools: [],
  },
];

export function listBuildTopicLinks(topic: BuildTopic): BuildLink[] {
  return [
    topic.primaryLink,
    ...topic.links,
    ...topic.tools.flatMap((tool) => [...tool.links, ...(tool.access ? [tool.access.apiKey] : [])]),
  ];
}

export function getBuildFooterLinks(
  topics: readonly BuildTopic[] = buildTopics,
): BuildFooterLink[] {
  return [
    { kind: "internal", label: buildPage.label, to: BUILD_PAGE_PATH },
    ...topics.map(
      (topic): BuildFooterLink => ({
        kind: "external",
        label: topic.primaryLink.label,
        href: topic.primaryLink.href,
      }),
    ),
    { kind: "internal", label: "Brand", to: "/brand" },
  ];
}
