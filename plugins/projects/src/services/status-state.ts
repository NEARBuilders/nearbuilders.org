export type StatusCheckKind = "everything-dev-health" | "ping" | "http";
export type StatusCheckStatus = "draft" | "listed" | "paused" | "archived";
export type StatusState = "up" | "degraded" | "down";
export type StatusDisplayState = StatusState | "unknown";

export const STATUS_FAILURE_REASONS = [
  "timeout",
  "dns",
  "tls",
  "connection",
  "blocked",
  "http_4xx",
  "http_5xx",
  "bad_body",
] as const;

export const STATUS_DEGRADED_REASONS = [
  "plugin_failure",
  "snapshot_degraded",
  "not_ready",
  "slow",
] as const;

export type StatusFailureReason = (typeof STATUS_FAILURE_REASONS)[number];
export type StatusReason = StatusFailureReason | (typeof STATUS_DEGRADED_REASONS)[number];

export const STATUS_POLL_INTERVAL_MS = 5 * 60 * 1000;
export const STATUS_TIMEOUT_MS = 10_000;
export const STATUS_SLOW_MS = 5_000;
export const STATUS_MAX_BODY_BYTES = 64 * 1024;
export const STATUS_MAX_REDIRECTS = 2;
export const STATUS_HISTORY_DAYS = 7;
export const STATUS_STALE_AFTER_MS = 3 * STATUS_POLL_INTERVAL_MS;
export const STATUS_MAX_CHECKS_PER_PROJECT = 5;
export const STATUS_RUN_COOLDOWN_MS = 60 * 1000;

export interface StatusOutcome {
  state: StatusState;
  reason: StatusReason | null;
  httpStatus: number | null;
  latencyMs: number | null;
  pluginKeys: string[];
}

export interface StatusResponse {
  httpStatus: number;
  body: string | null;
  latencyMs: number;
}

const failureReasons = new Set<string>(STATUS_FAILURE_REASONS);
const PLUGIN_KEY_PATTERN = /^[a-z0-9@][a-z0-9@/._-]{0,63}$/i;

export function isFailureReason(reason: string | null | undefined): boolean {
  return reason !== null && reason !== undefined && failureReasons.has(reason);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(body: string | null): unknown {
  if (body === null) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function failedPluginKeys(failures: unknown[]): string[] {
  const keys = failures
    .map((failure) => (isRecord(failure) ? failure.pluginKey : undefined))
    .filter((key): key is string => typeof key === "string" && PLUGIN_KEY_PATTERN.test(key));
  return [...new Set(keys)].slice(0, 10);
}

function down(reason: StatusFailureReason, response: StatusResponse | null): StatusOutcome {
  return {
    state: "down",
    reason,
    httpStatus: response?.httpStatus ?? null,
    latencyMs: response?.latencyMs ?? null,
    pluginKeys: [],
  };
}

function evaluateHealthBody(body: unknown): Pick<StatusOutcome, "state" | "reason" | "pluginKeys"> {
  if (!isRecord(body) || typeof body.status !== "string") {
    return { state: "down", reason: "bad_body", pluginKeys: [] };
  }
  const failures = Array.isArray(body.failures) ? body.failures : [];
  const hasError = typeof body.error === "string" && body.error.length > 0;
  if (failures.length > 0 || hasError) {
    return { state: "degraded", reason: "plugin_failure", pluginKeys: failedPluginKeys(failures) };
  }
  if (isRecord(body.snapshot) && body.snapshot.degraded === true) {
    return { state: "degraded", reason: "snapshot_degraded", pluginKeys: [] };
  }
  const ssrStatus = isRecord(body.ssr) ? body.ssr.status : undefined;
  if (body.status !== "ready" || (ssrStatus !== undefined && ssrStatus !== "ready")) {
    return { state: "degraded", reason: "not_ready", pluginKeys: [] };
  }
  return { state: "up", reason: null, pluginKeys: [] };
}

function evaluatePingBody(body: unknown): Pick<StatusOutcome, "state" | "reason" | "pluginKeys"> {
  if (isRecord(body) && body.status === "ok") {
    return { state: "up", reason: null, pluginKeys: [] };
  }
  return { state: "down", reason: "bad_body", pluginKeys: [] };
}

export function evaluateResponse(kind: StatusCheckKind, response: StatusResponse): StatusOutcome {
  if (response.httpStatus >= 500) return down("http_5xx", response);
  if (response.httpStatus >= 400) return down("http_4xx", response);
  if (response.httpStatus < 200 || response.httpStatus >= 300) return down("bad_body", response);

  const verdict =
    kind === "http"
      ? { state: "up" as const, reason: null, pluginKeys: [] }
      : kind === "ping"
        ? evaluatePingBody(parseJson(response.body))
        : evaluateHealthBody(parseJson(response.body));

  if (verdict.state === "up" && response.latencyMs > STATUS_SLOW_MS) {
    return {
      state: "degraded",
      reason: "slow",
      httpStatus: response.httpStatus,
      latencyMs: response.latencyMs,
      pluginKeys: [],
    };
  }
  return { ...verdict, httpStatus: response.httpStatus, latencyMs: response.latencyMs };
}

export function evaluateFailure(
  reason: StatusFailureReason,
  latencyMs: number | null,
): StatusOutcome {
  return { state: "down", reason, httpStatus: null, latencyMs, pluginKeys: [] };
}

export function applyFlapGuard(
  outcome: StatusOutcome,
  previousReason: string | null | undefined,
): StatusOutcome {
  if (outcome.state !== "down" || isFailureReason(previousReason)) return outcome;
  return { ...outcome, state: "degraded" };
}

export function displayState(
  status: StatusCheckStatus,
  latest: { state: string; checkedAt: Date } | null,
  now: Date,
): StatusDisplayState {
  if (status !== "listed" || !latest) return "unknown";
  if (now.getTime() - latest.checkedAt.getTime() > STATUS_STALE_AFTER_MS) return "unknown";
  return latest.state as StatusState;
}

export function historyCutoff(now: Date): Date {
  return new Date(now.getTime() - STATUS_HISTORY_DAYS * 24 * 60 * 60 * 1000);
}
