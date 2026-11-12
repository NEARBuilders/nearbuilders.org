import type { LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns";
import { BlockList, isIP } from "node:net";

export class StatusBlockedError extends Error {
  readonly code = "STATUS_BLOCKED";
}

const blockedV4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedV4.addSubnet(network, prefix, "ipv4");
}

const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");

const blockedV6 = new BlockList();
for (const [network, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
] as const) {
  blockedV6.addSubnet(network, prefix, "ipv6");
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".lan"];

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  if (family === 6) {
    return globalV6.check(address, "ipv6") && !blockedV6.check(address, "ipv6");
  }
  return false;
}

function bareHostname(hostname: string): string {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  return lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
}

export type StatusUrlResult = { ok: true; url: URL } | { ok: false; message: string };

export function checkStatusUrl(
  value: string,
  options: { allowQuery?: boolean } = {},
): StatusUrlResult {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: "Enter a full https:// URL" };
  }
  if (url.protocol !== "https:") return { ok: false, message: "Status checks must use https" };
  if (url.username || url.password) {
    return { ok: false, message: "Status check URLs can't contain credentials" };
  }
  if (url.port) return { ok: false, message: "Status checks must use the default https port" };
  if (!options.allowQuery && (url.search || url.hash)) {
    return { ok: false, message: "Status check URLs can't have a query string" };
  }
  const host = bareHostname(url.hostname);
  if (isIP(host)) {
    return isPublicAddress(host)
      ? { ok: true, url }
      : { ok: false, message: "Status checks must point at a public host" };
  }
  if (
    !host.includes(".") ||
    host === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return { ok: false, message: "Status checks must point at a public host" };
  }
  return { ok: true, url };
}

export type HostResolver = (hostname: string) => Promise<LookupAddress[]>;

export const resolveHost: HostResolver = (hostname) =>
  new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses);
    });
  });

export async function assertPublicHost(hostname: string, resolver: HostResolver = resolveHost) {
  const host = bareHostname(hostname);
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new StatusBlockedError(`Blocked address for ${host}`);
    return;
  }
  const addresses = await resolver(host);
  if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new StatusBlockedError(`Blocked address for ${host}`);
  }
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

export function createGuardedLookup(resolver: HostResolver = resolveHost) {
  return (hostname: string, options: { all?: boolean }, callback: LookupCallback) => {
    resolver(bareHostname(hostname)).then(
      (addresses) => {
        if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) {
          callback(new StatusBlockedError(`Blocked address for ${hostname}`), []);
          return;
        }
        if (options.all) {
          callback(null, addresses);
          return;
        }
        const [first] = addresses;
        callback(null, first!.address, first!.family);
      },
      (error: NodeJS.ErrnoException) => callback(error, []),
    );
  };
}
