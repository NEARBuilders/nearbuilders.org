import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";
import { asPluginEntries } from "../helpers/plugin-entries";

describe("getProjectFeedback", () => {
  const runtimes: Array<ReturnType<typeof createPluginRuntime>> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  });

  async function loadApi(feedbackDetail: unknown) {
    const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
    runtimes.push(runtime);
    const getProjectBySlug = vi.fn(async () => feedbackDetail);
    const loaded = await runtime.usePlugin(
      "api",
      {
        variables: { reviewEvaluationEnabled: false, feedbackBaseUrl: "https://feedback.example" },
        secrets: { API_DATABASE_URL: "pglite::memory:" },
      },
      asPluginEntries({
        activity: () => ({}),
        builders: () => ({}),
        events: () => ({}),
        feedback: () => ({ getProjectBySlug }),
        nearcatalog: () => ({}),
        notifications: () => ({}),
        projects: () => ({
          getProject: async ({ id }: { id: string }) => ({ data: { id, slug: "demo-app" } }),
        }),
        proposals: () => ({}),
        votes: () => ({}),
      } as never),
    );
    return { loaded, getProjectBySlug };
  }

  it("looks the project up on feedback by its slug", async () => {
    const { loaded, getProjectBySlug } = await loadApi({
      slug: "demo-app",
      rounds: [{ title: "Beta", status: "open", projectRoundNumber: 1, endsAt: null }],
    });
    const result = await loaded.createClient({}).getProjectFeedback({ projectId: "proj_1" });
    expect(getProjectBySlug).toHaveBeenCalledWith({ slug: "demo-app" });
    expect(result).toMatchObject({
      status: "open",
      openRound: { number: 1, title: "Beta", url: "https://feedback.example/projects/demo-app/1" },
    });
  });

  it("maps an unknown project to status none", async () => {
    const { loaded } = await loadApi({ slug: "demo-app", rounds: [] });
    const result = await loaded.createClient({}).getProjectFeedback({ projectId: "proj_1" });
    expect(result).toMatchObject({
      status: "registered",
      openRound: null,
      pastRounds: 0,
    });
  });
});
