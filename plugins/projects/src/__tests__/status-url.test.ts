import type { LookupAddress } from "node:dns";
import { describe, expect, it, vi } from "vitest";
import { probeStatusCheck } from "../services/status-probe";
import {
  assertPublicHost,
  checkStatusUrl,
  createGuardedLookup,
  isPublicAddress,
  StatusBlockedError,
} from "../services/status-url";

const resolveTo =
  (...addresses: string[]) =>
  async (): Promise<LookupAddress[]> =>
    addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));

describe("status check SSRF guard", () => {
  it.each([
    "10.1.2.3",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.10",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "64:ff9b::a00:1",
    "2001:db8::1",
    "2002:7f00:1::",
    "not-an-ip",
  ])("rejects %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    "104.18.32.7",
    "8.8.8.8",
    "2606:4700::6810:84e5",
    "2a00:1450:4001:82a::200e",
  ])("accepts %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ["http://nearbuilders.org/health", "https"],
    ["https://user:pass@nearbuilders.org/health", "credentials"],
    ["https://nearbuilders.org:8443/health", "port"],
    ["https://nearbuilders.org/health?token=1", "query"],
    ["https://localhost/health", "public host"],
    ["https://api.localhost/health", "public host"],
    ["https://metadata.google.internal/", "public host"],
    ["https://intranet/health", "public host"],
    ["https://127.0.0.1/health", "public host"],
    ["https://169.254.169.254/latest/meta-data", "public host"],
    ["https://[::1]/health", "public host"],
    ["https://[::ffff:7f00:1]/health", "public host"],
    ["file:///etc/passwd", "https"],
    ["not a url", "URL"],
  ])("rejects the URL %s", (url, message) => {
    const result = checkStatusUrl(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(message);
  });

  it("accepts public https URLs", () => {
    expect(checkStatusUrl("https://nearbuilders.org/health").ok).toBe(true);
    expect(checkStatusUrl("https://8.8.8.8/health").ok).toBe(true);
  });

  it("allows a query string only on redirects", () => {
    expect(checkStatusUrl("https://nearbuilders.org/health?x=1", { allowQuery: true }).ok).toBe(
      true,
    );
  });

  it("rejects hosts that resolve to any private address", async () => {
    await expect(
      assertPublicHost("nearbuilders.org", resolveTo("104.18.32.7")),
    ).resolves.toBeUndefined();
    await expect(
      assertPublicHost("rebind.example.com", resolveTo("104.18.32.7", "10.0.0.1")),
    ).rejects.toBeInstanceOf(StatusBlockedError);
    await expect(
      assertPublicHost("metadata.example.com", resolveTo("169.254.169.254")),
    ).rejects.toBeInstanceOf(StatusBlockedError);
    await expect(assertPublicHost("empty.example.com", resolveTo())).rejects.toBeInstanceOf(
      StatusBlockedError,
    );
  });

  it("re-checks the address on every connection through the guarded lookup", async () => {
    const resolver = vi
      .fn<() => Promise<LookupAddress[]>>()
      .mockResolvedValueOnce([{ address: "104.18.32.7", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    const lookup = createGuardedLookup(resolver);
    const call = () =>
      new Promise<{ error: Error | null; address: unknown }>((resolve) =>
        lookup("nearbuilders.org", {}, (error, address) => resolve({ error, address })),
      );
    expect(await call()).toEqual({ error: null, address: "104.18.32.7" });
    const second = await call();
    expect(second.error).toBeInstanceOf(StatusBlockedError);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("never connects when a check resolves to a private address", async () => {
    const outcome = await probeStatusCheck("everything-dev-health", "https://evil.example.com/h", {
      resolver: resolveTo("127.0.0.1"),
    });
    expect(outcome).toMatchObject({ state: "down", reason: "blocked", httpStatus: null });
  });

  it("refuses private IP literals before any request", async () => {
    const outcome = await probeStatusCheck("http", "https://169.254.169.254/latest/meta-data");
    expect(outcome).toMatchObject({ state: "down", reason: "blocked" });
  });

  it("reports DNS failures", async () => {
    const outcome = await probeStatusCheck("http", "https://missing.example.com/health", {
      resolver: async () => {
        throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
      },
    });
    expect(outcome).toMatchObject({ state: "down", reason: "dns" });
  });
});
