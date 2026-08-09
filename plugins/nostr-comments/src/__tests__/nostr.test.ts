import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { NostrCommentService } from "../services/nostr.js";

describe("NostrCommentService", () => {
  it("initializes with standard relays only", () => {
    const service = new NostrCommentService({
      standardRelays: ["wss://nos.lol"],
    });

    expect(service.hasAdapter("standard")).toBe(true);
    expect(service.hasAdapter("buzz")).toBe(false);
    service.close();
  });

  it("throws for unknown adapter", () => {
    const service = new NostrCommentService({
      standardRelays: ["wss://nos.lol"],
    });

    expect(() => service.getAdapter("unknown")).toThrow("Unknown adapter: unknown");
    service.close();
  });

  it("initializes with both adapters", () => {
    const { generateSecretKey } = require("nostr-tools/pure");
    const secretKey = generateSecretKey();

    const service = new NostrCommentService({
      standardRelays: ["wss://nos.lol"],
      buzzRelays: ["wss://example.com"],
      buzzSecretKey: secretKey,
    });

    expect(service.hasAdapter("standard")).toBe(true);
    expect(service.hasAdapter("buzz")).toBe(true);
    service.close();
  });

  it("initializes without buzz when no secretKey provided", () => {
    const service = new NostrCommentService({
      buzzRelays: ["wss://example.com"],
    });

    expect(service.hasAdapter("buzz")).toBe(false);
    service.close();
  });
});

describe("NostrCommentService - listComments", () => {
  const service = new NostrCommentService({
    standardRelays: ["wss://nos.lol", "wss://relay.damus.io"],
  });

  afterAll(() => service.close());

  it("queries standard relay for comments", async () => {
    // This hits a real relay — acceptable for integration test
    const comments = await service.listComments({
      target: "test-nonexistent-12345",
      targetType: "project",
      adapterType: "standard",
      limit: 10,
    });

    // Should return empty (no comments for this target)
    expect(Array.isArray(comments)).toBe(true);
    for (const c of comments) {
      expect(c.target).toBe("test-nonexistent-12345");
      expect(c.targetType).toBe("project");
      expect(c.source).toBe("standard");
    }
  }, 15_000);

  it("throws for unconfigured adapter", async () => {
    await expect(
      service.listComments({
        target: "test",
        targetType: "project",
        adapterType: "buzz",
      }),
    ).rejects.toThrow("Unknown adapter: buzz");
  });
});
