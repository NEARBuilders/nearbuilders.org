import { App } from "everything-dev/descriptor";

// Authored app descriptor. The published config is canonicalized to JSON
// from this file; dev-only overrides live in bos.dev.ts (never published).
export default App({
  name: "nearbuilders.org",
  extends: "bos://dev.everything.near/everything.dev",
  platform: "2.0.0-rc.27",
  account: "nearbuilding.near",
  domain: "nearbuilders.org",
  title: "NEAR Builders",
  description: "The open platform for builders on NEAR.",
  testnet: "dev.allthethings.testnet",
  staging: {
    domain: "staging.dev.everything.dev",
  },
  repository: "https://github.com/nearbuilders/nearbuilders.org",
  ci: {
    railway: {
      service: "app",
    },
  },
  ui: {
    path: "ui",
  },
  api: {
    path: "api",
    secrets: [
      "API_DATABASE_URL",
      "NEARAI_API_KEY",
      "NEARAI_MODEL",
      "GITHUB_TOKEN",
      "REQUIRE_ADMIN_APPROVAL",
      "BETTER_AUTH_SECRET",
    ],
  },
  plugins: {
    apps: {
      path: "plugins/apps",
      variables: {
        registryNamespace: "dev.everything.near",
      },
    },
    projects: {
      path: "plugins/projects",
      secrets: ["PROJECTS_DATABASE_URL"],
    },
    builders: {
      path: "plugins/builders",
      variables: {
        nominationJoinBaseUrl: "https://nearbuilders.org",
      },
      secrets: ["BUILDERS_DATABASE_URL", "NOMINATION_TOKEN_SECRET"],
    },
    events: {
      path: "plugins/events",
      secrets: ["EVENTS_DATABASE_URL", "LUMA_CALENDAR_API_KEYS"],
    },
    proposals: {
      path: "plugins/proposals",
      variables: {
        privatePluginIds: ["nearcatalog", "projects", "events"],
      },
      secrets: ["PROPOSALS_DATABASE_URL"],
    },
    votes: {
      path: "plugins/votes",
      secrets: ["VOTES_DATABASE_URL"],
    },
    bookmarks: {
      path: "plugins/bookmarks",
      secrets: ["BOOKMARKS_DATABASE_URL"],
    },
    notifications: {
      path: "plugins/notifications",
      secrets: ["NOTIFICATIONS_DATABASE_URL"],
    },
    activity: {
      path: "plugins/activity",
      secrets: [
        "ACTIVITY_DATABASE_URL",
        "ACTIVITY_GATEWAY_URL",
        "ACTIVITY_GATEWAY_API_KEY",
        "ACTIVITY_SOURCE_ID",
      ],
    },
    nearcatalog: {
      path: "plugins/nearcatalog",
      variables: {
        baseUrl: "https://api.nearcatalog.xyz",
      },
      secrets: ["NEARCATALOG_DATABASE_URL"],
    },
    credits: {
      path: "plugins/credits",
      dependsOn: ["builders"],
      secrets: [
        "CREDITS_DATABASE_URL",
        "CREDITS_ENABLED",
        "CREDITS_AMOUNT_USD",
        "CREDITS_CLAIMS_CLOSE_AT",
        "CREDITS_KEY_EXPIRES_AT",
        "NEARAI_CREDITS_REFRESH_TOKEN",
        "NEARAI_CREDITS_USER_AGENT",
        "NEARAI_CREDITS_WORKSPACE_ID",
      ],
    },
    nostr: {
      extends: "bos://nearbuilding.near/nostr.nearbuilders.org#plugins.nostr",
      ui: false,
      variables: {
        clientName: "nearbuilders.org",
      },
    },
  },
});
