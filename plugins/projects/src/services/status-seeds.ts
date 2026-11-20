export interface StatusSeed {
  projectSlug: string;
  label: string;
  url: string;
}

export const STATUS_SEEDS: readonly StatusSeed[] = [
  {
    projectSlug: "nearbuilders-org-6qx6jv",
    label: "nearbuilders.org",
    url: "https://nearbuilders.org/health",
  },
  {
    projectSlug: "feedback-nearbuilders-org-ew364z",
    label: "feedback.nearbuilders.org",
    url: "https://feedback.nearbuilders.org/health",
  },
  {
    projectSlug: "activity-nearbuilders-org-2erd1k",
    label: "activity.nearbuilders.org",
    url: "https://activity.nearbuilders.org/health",
  },
  {
    projectSlug: "nostr-nearbuilders-org",
    label: "nostr.nearbuilders.org",
    url: "https://nostr.nearbuilders.org/health",
  },
  {
    projectSlug: "citynode-app",
    label: "citynode.app",
    url: "https://citynode.app/health",
  },
  {
    projectSlug: "everything-dev-x8rypo",
    label: "everything.dev",
    url: "https://everything.dev/health",
  },
];
