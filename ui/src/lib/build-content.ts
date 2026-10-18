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

export type BuildTopicLogo = "near-ai" | "near-intents" | "near-protocol";

export type BuildTopic = {
  id: BuildTopicId;
  title: string;
  logo: BuildTopicLogo;
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
    "Pick a topic, open the docs, and start shipping. Kept current by the builder community.",
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
    logo: "near-ai",
    summary: "Run AI models and agents on private, verifiable compute with NEAR AI.",
    primaryLink: { label: "NEAR AI Docs", href: "https://docs.near.ai" },
    links: [],
    tools: [
      {
        id: "near-ai-cloud",
        name: "NEAR AI Cloud",
        summary:
          "Call open models through an OpenAI-compatible API, running inside private, verifiable hardware.",
        links: [
          {
            label: "Agent skill",
            href: "https://github.com/near/agent-skills/tree/main/skills/near-ai-cloud",
          },
          { label: "Models", href: "https://near.ai/models" },
        ],
        access: {
          title: "Get access",
          apiKeyStep: "Get an API key from the NEAR AI Cloud dashboard.",
          apiKey: { label: "Get an API key", href: "https://cloud.near.ai" },
          baseUrlStep: "Point any OpenAI SDK at the base URL.",
          baseUrl: "https://cloud-api.near.ai/v1",
        },
      },
    ],
  },
  {
    id: "agentic-commerce",
    title: "Agentic Commerce",
    logo: "near-intents",
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
    logo: "near-protocol",
    summary: "Write, test and deploy contracts and apps on NEAR Protocol.",
    primaryLink: { label: "NEAR Docs", href: "https://docs.near.org" },
    links: [],
    tools: [
      {
        id: "near-contracts",
        name: "Write a contract",
        summary:
          "Learn how contracts work on NEAR, pick an SDK, start from a reference contract, and get testnet NEAR to deploy it.",
        links: [
          {
            label: "What is a smart contract",
            href: "https://docs.near.org/smart-contracts/what-is",
          },
          { label: "SDK libraries", href: "https://docs.near.org/tools/sdk" },
          { label: "Reference contracts", href: "https://docs.near.org/tools/contracts-list" },
          { label: "Testnet faucet", href: "https://near-faucet.io" },
        ],
      },
    ],
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

export const BUILDER_TELEGRAM_URL = "https://t.me/nearbuilderschat";

export type BuildGetInvolvedAction =
  | {
      id: string;
      kind: "internal";
      label: string;
      description: string;
      to: "/projects/new/$kind";
      params: { kind: "project" };
      search: { tab: "write" };
    }
  | {
      id: string;
      kind: "external";
      label: string;
      description: string;
      href: string;
    };

export type BuildGetInvolved = {
  title: string;
  description: string;
  featuredProjectSlugs: readonly string[];
  actions: readonly BuildGetInvolvedAction[];
};

export const buildGetInvolved: BuildGetInvolved = {
  title: "Get involved",
  description:
    "Help shape the tools builders use, share what you are working on, and meet other builders.",
  featuredProjectSlugs: ["feedback-nearbuilders-org-ew364z", "activity-nearbuilders-org-2erd1k"],
  actions: [
    {
      id: "share-project",
      kind: "internal",
      label: "Share a project",
      description: "Add what you are building so other builders can find it and pitch in.",
      to: "/projects/new/$kind",
      params: { kind: "project" },
      search: { tab: "write" },
    },
    {
      id: "telegram",
      kind: "external",
      label: "Join the builder chat",
      description: "Ask questions, find collaborators and follow what is shipping, on Telegram.",
      href: BUILDER_TELEGRAM_URL,
    },
  ],
};

export function getBuildGetInvolvedActionHref(action: BuildGetInvolvedAction) {
  return action.kind === "internal" ? action.to.replace("$kind", action.params.kind) : action.href;
}
