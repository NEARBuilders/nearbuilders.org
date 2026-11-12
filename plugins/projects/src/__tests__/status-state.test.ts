import { describe, expect, it } from "vitest";
import {
  applyFlapGuard,
  displayState,
  evaluateFailure,
  evaluateResponse,
  historyCutoff,
  STATUS_POLL_INTERVAL_MS,
} from "../services/status-state";

const readyHealth = {
  status: "ready",
  api: "ready",
  auth: "ready",
  ssr: { status: "ready", selfProbe: { status: "passed" } },
  snapshot: { booted: false, adopted: true, degraded: false },
  warnings: [{ pluginKey: "auth", message: "Declared secret GITHUB_CLIENT_SECRET is not set" }],
};

const ok = (body: unknown, latencyMs = 800) => ({
  httpStatus: 200,
  body: JSON.stringify(body),
  latencyMs,
});

describe("status state mapping", () => {
  it("marks a ready everything-dev health body as up and drops warnings", () => {
    const outcome = evaluateResponse("everything-dev-health", ok(readyHealth));
    expect(outcome).toEqual({
      state: "up",
      reason: null,
      httpStatus: 200,
      latencyMs: 800,
      pluginKeys: [],
    });
    expect(JSON.stringify(outcome)).not.toContain("secret");
  });

  it("marks a 200 health body with plugin failures as degraded, keeping only plugin keys", () => {
    const outcome = evaluateResponse(
      "everything-dev-health",
      ok({
        ...readyHealth,
        error: "Plugin nostr at https://cdn.example.com/nostr failed: version skew",
        failures: [
          {
            pluginKey: "nostr",
            pluginUrl: "https://cdn.example.com/nostr",
            message: "Refusing to load plugin: shared dependency version skew",
          },
          { pluginKey: "nostr", message: "again" },
          { pluginKey: "<script>alert(1)</script>", message: "bad key" },
        ],
      }),
    );
    expect(outcome.state).toBe("degraded");
    expect(outcome.reason).toBe("plugin_failure");
    expect(outcome.pluginKeys).toEqual(["nostr"]);
    expect(JSON.stringify(outcome)).not.toContain("skew");
    expect(JSON.stringify(outcome)).not.toContain("cdn.example.com");
  });

  it("marks a degraded snapshot and a non-ready status as degraded", () => {
    expect(
      evaluateResponse(
        "everything-dev-health",
        ok({ ...readyHealth, snapshot: { degraded: true } }),
      ),
    ).toMatchObject({ state: "degraded", reason: "snapshot_degraded" });
    expect(
      evaluateResponse("everything-dev-health", ok({ ...readyHealth, status: "starting" })),
    ).toMatchObject({ state: "degraded", reason: "not_ready" });
    expect(
      evaluateResponse("everything-dev-health", ok({ ...readyHealth, ssr: { status: "failed" } })),
    ).toMatchObject({ state: "degraded", reason: "not_ready" });
  });

  it("marks bodies that aren't the expected shape as down", () => {
    expect(
      evaluateResponse("everything-dev-health", { httpStatus: 200, body: "<html>", latencyMs: 5 }),
    ).toMatchObject({ state: "down", reason: "bad_body" });
    expect(evaluateResponse("everything-dev-health", ok([1, 2]))).toMatchObject({
      state: "down",
      reason: "bad_body",
    });
    expect(
      evaluateResponse("everything-dev-health", { httpStatus: 200, body: null, latencyMs: 5 }),
    ).toMatchObject({ state: "down", reason: "bad_body" });
    expect(evaluateResponse("ping", ok({ status: "error" }))).toMatchObject({
      state: "down",
      reason: "bad_body",
    });
  });

  it("maps ping and plain http checks", () => {
    expect(evaluateResponse("ping", ok({ status: "ok" }))).toMatchObject({ state: "up" });
    expect(evaluateResponse("http", { httpStatus: 204, body: "", latencyMs: 10 })).toMatchObject({
      state: "up",
    });
  });

  it("maps non-2xx responses to down with an http reason", () => {
    expect(evaluateResponse("http", { httpStatus: 503, body: "", latencyMs: 10 })).toMatchObject({
      state: "down",
      reason: "http_5xx",
      httpStatus: 503,
    });
    expect(
      evaluateResponse("everything-dev-health", { httpStatus: 404, body: "", latencyMs: 10 }),
    ).toMatchObject({ state: "down", reason: "http_4xx" });
  });

  it("maps unfollowed 1xx and 3xx responses to bad_body", () => {
    expect(evaluateResponse("http", { httpStatus: 304, body: "", latencyMs: 10 })).toMatchObject({
      state: "down",
      reason: "bad_body",
    });
  });

  it("marks slow but healthy responses as degraded", () => {
    expect(evaluateResponse("everything-dev-health", ok(readyHealth, 5_001))).toMatchObject({
      state: "degraded",
      reason: "slow",
    });
    expect(evaluateResponse("everything-dev-health", ok(readyHealth, 5_000))).toMatchObject({
      state: "up",
    });
  });

  it("maps request failures to down", () => {
    expect(evaluateFailure("timeout", 10_000)).toEqual({
      state: "down",
      reason: "timeout",
      httpStatus: null,
      latencyMs: 10_000,
      pluginKeys: [],
    });
  });
});

describe("flap guard", () => {
  const failure = evaluateFailure("connection", 20);

  it("shows the first failure as degraded", () => {
    expect(applyFlapGuard(failure, undefined).state).toBe("degraded");
    expect(applyFlapGuard(failure, null).state).toBe("degraded");
    expect(applyFlapGuard(failure, "plugin_failure").state).toBe("degraded");
  });

  it("shows a second failure in a row as down", () => {
    expect(applyFlapGuard(failure, "timeout").state).toBe("down");
    expect(applyFlapGuard(failure, "http_5xx").state).toBe("down");
  });

  it("leaves up and degraded outcomes alone", () => {
    const up = evaluateResponse("everything-dev-health", ok(readyHealth));
    expect(applyFlapGuard(up, "timeout")).toEqual(up);
  });
});

describe("display state", () => {
  const now = new Date("2026-11-12T10:00:00Z");

  it("is unknown without a result, when paused, or when results are stale", () => {
    expect(displayState("listed", null, now)).toBe("unknown");
    expect(displayState("paused", { state: "up", checkedAt: now }, now)).toBe("unknown");
    expect(displayState("draft", { state: "up", checkedAt: now }, now)).toBe("unknown");
    const stale = new Date(now.getTime() - 3 * STATUS_POLL_INTERVAL_MS - 1);
    expect(displayState("listed", { state: "up", checkedAt: stale }, now)).toBe("unknown");
  });

  it("uses the latest stored state while results are fresh", () => {
    const fresh = new Date(now.getTime() - STATUS_POLL_INTERVAL_MS);
    expect(displayState("listed", { state: "down", checkedAt: fresh }, now)).toBe("down");
  });

  it("keeps seven days of history", () => {
    expect(historyCutoff(now).toISOString()).toBe("2026-11-05T10:00:00.000Z");
  });
});
