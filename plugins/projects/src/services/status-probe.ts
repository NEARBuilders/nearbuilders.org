import { request } from "node:https";
import {
  evaluateFailure,
  evaluateResponse,
  STATUS_MAX_BODY_BYTES,
  STATUS_MAX_REDIRECTS,
  STATUS_TIMEOUT_MS,
  type StatusCheckKind,
  type StatusFailureReason,
  type StatusOutcome,
} from "./status-state";
import {
  assertPublicHost,
  checkStatusUrl,
  createGuardedLookup,
  type HostResolver,
  resolveHost,
  StatusBlockedError,
} from "./status-url";

export const STATUS_USER_AGENT = "nearbuilders-status";

export interface ProbeOptions {
  resolver?: HostResolver;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
}

interface RawResponse {
  httpStatus: number;
  location: string | null;
  body: string | null;
}

class ProbeFailure extends Error {
  constructor(readonly reason: StatusFailureReason) {
    super(reason);
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL", "EAI_NODATA", "ENODATA"]);
const TLS_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

export function failureReasonFor(error: unknown): StatusFailureReason {
  if (error instanceof ProbeFailure) return error.reason;
  if (error instanceof StatusBlockedError) return "blocked";
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || code === "ABORT_ERR") return "timeout";
  if (DNS_CODES.has(code)) return "dns";
  if (TLS_CODES.has(code) || code.startsWith("ERR_TLS") || code.startsWith("ERR_SSL")) {
    return "tls";
  }
  return "connection";
}

function requestOnce(
  url: URL,
  signal: AbortSignal,
  lookup: ReturnType<typeof createGuardedLookup>,
  maxBytes: number,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        agent: false,
        lookup,
        signal,
        headers: {
          "user-agent": STATUS_USER_AGENT,
          accept: "application/json, */*;q=0.5",
        },
      },
      (res) => {
        const httpStatus = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        if (REDIRECT_STATUSES.has(httpStatus)) {
          res.destroy();
          resolve({ httpStatus, location, body: null });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            truncated = true;
            res.destroy();
            resolve({ httpStatus, location, body: null });
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          if (!truncated) {
            resolve({ httpStatus, location, body: Buffer.concat(chunks).toString("utf8") });
          }
        });
        res.on("error", (error) => {
          if (!truncated) reject(error);
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function probeStatusCheck(
  kind: StatusCheckKind,
  target: string,
  options: ProbeOptions = {},
): Promise<StatusOutcome> {
  const lookup = createGuardedLookup(options.resolver ?? resolveHost);
  const maxRedirects = options.maxRedirects ?? STATUS_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? STATUS_MAX_BODY_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? STATUS_TIMEOUT_MS);
  const started = Date.now();
  try {
    const initial = checkStatusUrl(target);
    if (!initial.ok) throw new ProbeFailure("blocked");
    let url = initial.url;
    for (let redirects = 0; ; redirects += 1) {
      const response = await requestOnce(url, controller.signal, lookup, maxBytes);
      if (!REDIRECT_STATUSES.has(response.httpStatus)) {
        return evaluateResponse(kind, {
          httpStatus: response.httpStatus,
          body: response.body,
          latencyMs: Date.now() - started,
        });
      }
      if (!response.location || redirects >= maxRedirects) throw new ProbeFailure("blocked");
      const next = checkStatusUrl(new URL(response.location, url).toString(), {
        allowQuery: true,
      });
      if (!next.ok) throw new ProbeFailure("blocked");
      url = next.url;
    }
  } catch (error) {
    const reason = controller.signal.aborted ? "timeout" : failureReasonFor(error);
    return evaluateFailure(reason, Date.now() - started);
  } finally {
    clearTimeout(timer);
  }
}

export const assertHostIsPublic = (hostname: string) => assertPublicHost(hostname);
