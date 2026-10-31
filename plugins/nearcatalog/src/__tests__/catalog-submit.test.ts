import { describe, expect, it, vi } from "vitest";
import {
  CATALOG_PARTNER_SUBMIT_URL,
  catalogPartnerPayload,
  createCatalogSubmitClientFromConfig,
  createHttpCatalogSubmitClient,
} from "../services/catalog-submit";

const token = "nc_partner_unit41b2";
const contactInfo = "team@nearbuilders.example";
const record = {
  slug: "lantern-pay",
  title: "Lantern Pay",
  oneliner: "Payments for small shops",
  description: "Lantern Pay lets small shops take NEAR payments.",
  logo: "https://lantern.example.com/logo.png",
  categories: ["payment", "developer-tooling"],
  website: "https://lantern.example.com",
  twitter: "",
  medium: "",
  telegram: "https://t.me/lanternpay",
  github: "https://github.com/lantern-pay",
  discord: "",
  whitepaper: "",
  "token-address": "",
  "coingecko-address": "",
  "nearsocial-address": "https://near.social/lantern.testnet",
  dapp: "",
  phase: "Testnet",
  source: {
    site: "nearbuilders.org",
    url: "https://nearbuilders.org/projects/project/lantern-pay-x1",
    nearAccount: "maker.testnet",
    updatedAt: "2026-10-26T00:00:00.000Z",
  },
};

const success = () =>
  Response.json({
    status: "success",
    submission_id: "a1b2c3d4e5f6",
    message: "Project submitted successfully. Awaiting curator review.",
  });

function recordingFetch(reply: () => Response = success) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImplementation = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return reply();
  }) as unknown as typeof fetch;
  return { calls, fetchImplementation };
}

describe("NEAR Catalog submit client", () => {
  it("is off unless the partner key is set", () => {
    expect(createCatalogSubmitClientFromConfig({})).toBeNull();
    expect(
      createCatalogSubmitClientFromConfig({ url: "https://x.example", token: " " }),
    ).toBeNull();
    expect(createCatalogSubmitClientFromConfig({ token })).not.toBeNull();
  });

  it("maps the export record to the partner-submit fields", () => {
    expect(catalogPartnerPayload({ externalId: "project:p1", record, contactInfo })).toEqual({
      project_name: "Lantern Pay",
      project_description: "Lantern Pay lets small shops take NEAR payments.",
      project_logo: "https://lantern.example.com/logo.png",
      contact_info: contactInfo,
      one_liner: "Payments for small shops",
      primary_category: "Payment, Developer Tooling",
      uid: "project:p1",
      nearsocial_address: "lantern.testnet",
      website: "https://lantern.example.com",
      project_telegram: "https://t.me/lanternpay",
      github: "https://github.com/lantern-pay",
      project_phase: "Testnet",
    });
  });

  it("posts to the partner endpoint with a Bearer key and reads the submission id", async () => {
    const { calls, fetchImplementation } = recordingFetch();
    const client = createHttpCatalogSubmitClient({ token, contactInfo, fetchImplementation });

    await expect(client.upsertProject({ externalId: "project:p1", record })).resolves.toEqual({
      submissionId: "a1b2c3d4e5f6",
      fallbackContact: false,
    });
    expect(calls[0]?.url).toBe(CATALOG_PARTNER_SUBMIT_URL);
    expect(calls[0]?.init.method).toBe("POST");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe(`Bearer ${token}`);
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      project_name: "Lantern Pay",
      uid: "project:p1",
    });
  });

  it("sends the team's own contact and falls back to ours only when there is none", async () => {
    const { calls, fetchImplementation } = recordingFetch();
    const client = createHttpCatalogSubmitClient({ token, contactInfo, fetchImplementation });
    const contactOf = (index: number) => JSON.parse(String(calls[index]?.init.body)).contact_info;

    await expect(
      client.upsertProject({
        externalId: "project:p1",
        record: { ...record, contact: "maker@lantern.example.com" },
      }),
    ).resolves.toMatchObject({ fallbackContact: false });
    await client.upsertProject({ externalId: "project:p1", record });
    await expect(
      client.upsertProject({ externalId: "project:p1", record: { ...record, telegram: "" } }),
    ).resolves.toMatchObject({ fallbackContact: true });

    expect([contactOf(0), contactOf(1), contactOf(2)]).toEqual([
      "maker@lantern.example.com",
      "https://t.me/lanternpay",
      contactInfo,
    ]);
    await expect(
      createHttpCatalogSubmitClient({ token, fetchImplementation }).upsertProject({
        externalId: "project:p1",
        record: { ...record, telegram: "" },
      }),
    ).rejects.toThrow(/No contact for NEAR Catalog/);
  });

  it("treats validation errors sent as 500 as a failed send with NEAR Catalog's message", async () => {
    const { fetchImplementation } = recordingFetch(() =>
      Response.json(
        { code: "error", message: "Missing required fields: project_logo", data: null },
        { status: 500 },
      ),
    );
    const client = createHttpCatalogSubmitClient({ token, contactInfo, fetchImplementation });

    await expect(client.upsertProject({ externalId: "project:p1", record })).rejects.toThrow(
      "NEAR Catalog returned 500: Missing required fields: project_logo",
    );
  });

  it("never puts the key in an error", async () => {
    const { fetchImplementation } = recordingFetch(
      () => new Response(`invalid token ${token}`, { status: 401 }),
    );
    const client = createHttpCatalogSubmitClient({ token, contactInfo, fetchImplementation });

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
      token,
      contactInfo,
      fetchImplementation,
      timeoutMs: 50,
    });

    await expect(client.upsertProject({ externalId: "project:p1", record })).rejects.toThrow(
      /timed out after 50ms/,
    );
  });
});
