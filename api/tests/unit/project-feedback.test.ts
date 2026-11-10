import { ORPCError } from "@orpc/client";
import { describe, expect, it, vi } from "vitest";
import { createProjectFeedbackClient } from "../../src/services/project-feedback";

const BASE_URL = "https://feedback.example";
const NOW = Date.parse("2026-11-07T00:00:00.000Z");

function detail(rounds: Array<{ status: string; n: number; endsAt?: string | null }>) {
  return {
    slug: "demo-app",
    status: "approved",
    rounds: rounds.map(({ status, n, endsAt = null }) => ({
      id: `round-${n}`,
      ownerAccountId: "owner.near",
      title: `Round ${n}`,
      status,
      projectRoundNumber: n,
      endsAt,
    })),
  };
}

function client(
  getProjectBySlug: (...args: Array<{ slug: string }>) => Promise<unknown>,
  now = () => NOW,
) {
  return createProjectFeedbackClient({
    client: { getProjectBySlug: vi.fn(getProjectBySlug) },
    feedbackBaseUrl: BASE_URL,
    now,
  });
}

describe("project feedback lookup", () => {
  it("returns none when feedback doesn't know the project", async () => {
    const getProjectBySlug = vi.fn(async () => {
      throw new ORPCError("NOT_FOUND", { message: "Project not found" });
    });
    const result = await client(getProjectBySlug).lookup("demo-app");
    expect(getProjectBySlug).toHaveBeenCalledWith({ slug: "demo-app" });
    expect(result).toEqual({
      status: "none",
      openRound: null,
      pastRounds: 0,
      feedbackUrl: "https://feedback.example/manage/new?project=demo-app",
      requestUrl: "https://feedback.example/manage/new?project=demo-app",
    });
  });

  it("returns registered with the past round count when only closed rounds exist", async () => {
    const result = await client(async () =>
      detail([
        { status: "closed", n: 1 },
        { status: "closed", n: 2 },
        { status: "open", n: 3, endsAt: "2026-11-01T00:00:00.000Z" },
      ]),
    ).lookup("demo-app");
    expect(result).toMatchObject({
      status: "registered",
      openRound: null,
      pastRounds: 3,
      feedbackUrl: "https://feedback.example/projects/demo-app",
      requestUrl: "https://feedback.example/manage/new?project=demo-app",
    });
  });

  it("returns the latest open round", async () => {
    const result = await client(async () =>
      detail([
        { status: "closed", n: 1 },
        { status: "open", n: 2, endsAt: "2026-11-30T00:00:00.000Z" },
      ]),
    ).lookup("demo-app");
    expect(result).toEqual({
      status: "open",
      openRound: {
        number: 2,
        title: "Round 2",
        endsAt: "2026-11-30T00:00:00.000Z",
        url: "https://feedback.example/projects/demo-app/2",
      },
      pastRounds: 1,
      feedbackUrl: "https://feedback.example/projects/demo-app/2",
      requestUrl: "https://feedback.example/manage/new?project=demo-app",
    });
  });

  it("returns unknown when feedback is unreachable or answers badly", async () => {
    const down = async () => {
      throw new TypeError("fetch failed");
    };
    const broken = async () => {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "boom" });
    };
    const garbage = async () => ({ unexpected: true });
    for (const getProjectBySlug of [down, broken, garbage]) {
      const result = await client(getProjectBySlug).lookup("demo-app");
      expect(result).toMatchObject({
        status: "unknown",
        openRound: null,
        feedbackUrl: "https://feedback.example/manage/new?project=demo-app",
      });
    }
  });

  it("serves repeated lookups from the cache until it expires", async () => {
    let now = NOW;
    const getProjectBySlug = vi.fn(async () => detail([{ status: "closed", n: 1 }]));
    const feedback = client(getProjectBySlug, () => now);
    await feedback.lookup("demo-app");
    await feedback.lookup("demo-app");
    now += 59_000;
    await feedback.lookup("demo-app");
    expect(getProjectBySlug).toHaveBeenCalledTimes(1);
    now += 2_000;
    await feedback.lookup("demo-app");
    expect(getProjectBySlug).toHaveBeenCalledTimes(2);
  });

  it("retries a failed lookup sooner than a successful one", async () => {
    let now = NOW;
    const getProjectBySlug = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const feedback = client(getProjectBySlug, () => now);
    await feedback.lookup("demo-app");
    await feedback.lookup("demo-app");
    expect(getProjectBySlug).toHaveBeenCalledTimes(1);
    now += 11_000;
    await feedback.lookup("demo-app");
    expect(getProjectBySlug).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight request between concurrent lookups", async () => {
    const getProjectBySlug = vi.fn(async () => detail([]));
    const feedback = client(getProjectBySlug);
    const [a, b] = await Promise.all([feedback.lookup("demo-app"), feedback.lookup("demo-app")]);
    expect(getProjectBySlug).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.status).toBe("registered");
  });
});
