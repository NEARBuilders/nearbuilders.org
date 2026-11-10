import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";
import { asPluginEntries } from "../helpers/plugin-entries";

describe("getProjectFeedback", () => {
  const runtimes: Array<ReturnType<typeof createPluginRuntime>> = [];

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  });

  async function loadApi() {
    const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
    runtimes.push(runtime);
    return await runtime.usePlugin(
      "api",
      {
        variables: { reviewEvaluationEnabled: false, feedbackBaseUrl: "https://feedback.example" },
        secrets: { API_DATABASE_URL: "pglite::memory:" },
      },
      asPluginEntries({
        activity: () => ({}),
        builders: () => ({}),
        events: () => ({}),
        nearcatalog: () => ({}),
        notifications: () => ({}),
        projects: () => ({
          getProject: async ({ id }: { id: string }) => ({ data: { id, slug: "demo-app" } }),
        }),
        proposals: () => ({}),
        votes: () => ({}),
      } as never),
    );
  }

  it("looks the project up on feedback by its slug", async () => {
    const fetchMock = vi.fn(
      async (_url: Parameters<typeof fetch>[0], _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            json: {
              slug: "demo-app",
              rounds: [{ title: "Beta", status: "open", projectRoundNumber: 1, endsAt: null }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const loaded = await loadApi();
    const result = await loaded.createClient({}).getProjectFeedback({ projectId: "proj_1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://feedback.example/api/rpc/getProjectBySlug",
      expect.anything(),
    );
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init!.body))).toEqual({ json: { slug: "demo-app" } });
    expect(result).toMatchObject({
      status: "open",
      openRound: { number: 1, title: "Beta", url: "https://feedback.example/projects/demo-app/1" },
    });
  });
});
