import { describe, expect, it, vi } from "vitest";
import {
  catalogSubmitRequest,
  createCatalogSubmitClientFromConfig,
  createHttpCatalogSubmitClient,
} from "../services/catalog-submit";

const token = "nc-unit-token-41b2";
const record = { slug: "lantern-pay", title: "Lantern Pay" };

function recordingFetch(reply: () => Response = () => Response.json({})) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImplementation = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return reply();
  }) as unknown as typeof fetch;
  return { calls, fetchImplementation };
}

describe("NEAR Catalog submit client", () => {
  it("is off unless both the URL and the token are set", () => {
    expect(createCatalogSubmitClientFromConfig({})).toBeNull();
    expect(
      createCatalogSubmitClientFromConfig({ url: "https://x.example", token: " " }),
    ).toBeNull();
    expect(createCatalogSubmitClientFromConfig({ url: "", token })).toBeNull();
    expect(createCatalogSubmitClientFromConfig({ url: "https://x.example", token })).not.toBeNull();
  });

  it("keeps the request shape in one place", () => {
    expect(
      catalogSubmitRequest("https://x.example/v1/", "upsert", "person", "person:robin.testnet", {
        name: "Robin",
      }),
    ).toEqual({
      url: "https://x.example/v1/people/person%3Arobin.testnet",
      method: "PUT",
      body: {
        source: "nearbuilders",
        externalId: "person:robin.testnet",
        kind: "person",
        record: { name: "Robin" },
      },
    });
    expect(catalogSubmitRequest("https://x.example/v1", "remove", "project", "project:p1")).toEqual(
      {
        url: "https://x.example/v1/projects/project%3Ap1",
        method: "DELETE",
        body: { source: "nearbuilders", externalId: "project:p1", kind: "project" },
      },
    );
  });

  it("sends a Bearer token and reads the slug and URL from the reply", async () => {
    const { calls, fetchImplementation } = recordingFetch(() =>
      Response.json({ slug: "lantern", url: "https://nearcatalog.xyz/project/lantern" }),
    );
    const client = createHttpCatalogSubmitClient({
      baseUrl: "https://x.example/v1",
      token,
      fetchImplementation,
    });

    const result = await client.upsertProject({ externalId: "project:p1", record });

    expect(result).toEqual({ slug: "lantern", url: "https://nearcatalog.xyz/project/lantern" });
    expect(calls[0]?.url).toBe("https://x.example/v1/projects/project%3Ap1");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe(`Bearer ${token}`);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      source: "nearbuilders",
      externalId: "project:p1",
      kind: "project",
      record,
    });
  });

  it("falls back to the NEAR Catalog project page and ignores unsafe URLs", async () => {
    const { fetchImplementation } = recordingFetch(() =>
      Response.json({ slug: "lantern", url: "javascript:alert(1)" }),
    );
    const client = createHttpCatalogSubmitClient({
      baseUrl: "https://x.example",
      token,
      fetchImplementation,
    });

    await expect(client.upsertProject({ externalId: "project:p1", record })).resolves.toEqual({
      slug: "lantern",
      url: "https://nearcatalog.xyz/project/lantern",
    });
    await expect(client.upsertPerson({ externalId: "person:a.testnet", record })).resolves.toEqual({
      slug: "lantern",
      url: null,
    });
  });

  it("treats a 404 on remove as already removed", async () => {
    const { fetchImplementation } = recordingFetch(() => new Response("", { status: 404 }));
    const client = createHttpCatalogSubmitClient({
      baseUrl: "https://x.example",
      token,
      fetchImplementation,
    });

    await expect(
      client.remove({ kind: "project", externalId: "project:p1" }),
    ).resolves.toBeUndefined();
    await expect(client.upsertProject({ externalId: "project:p1", record })).rejects.toThrow(
      /returned 404/,
    );
  });

  it("never puts the token in an error", async () => {
    const { fetchImplementation } = recordingFetch(
      () => new Response(`invalid token ${token}`, { status: 401 }),
    );
    const client = createHttpCatalogSubmitClient({
      baseUrl: "https://x.example",
      token,
      fetchImplementation,
    });

    const error = await client.upsertProject({ externalId: "project:p1", record }).catch((e) => e);

    expect(error.message).toContain("NEAR Catalog returned 401");
    expect(error.message).not.toContain(token);
  });

  it("gives up after the timeout", async () => {
    const fetchImplementation = ((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as typeof fetch;
    const client = createHttpCatalogSubmitClient({
      baseUrl: "https://x.example",
      token,
      fetchImplementation,
      timeoutMs: 50,
    });

    await expect(client.upsertProject({ externalId: "project:p1", record })).rejects.toThrow(
      /timed out after 50ms/,
    );
  });
});
