import { afterEach, describe, expect, it, vi } from "vitest";
import { createUserIdRowClaimer } from "../lib/claim-user-id-rows";

describe("createUserIdRowClaimer (#366)", () => {
  afterEach(() => vi.restoreAllMocks());

  const linked = { userId: "user-fern", near: { primaryAccountId: "fern.near" } };

  it("claims once per user id and account", async () => {
    const claim = vi.fn(async () => {});
    const run = createUserIdRowClaimer("Test", claim);
    await run(linked);
    await run(linked);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith(linked, "user-fern", "fern.near");
  });

  it("clears the claimed set when it is full, so it stays bounded", async () => {
    const claim = vi.fn(async () => {});
    const run = createUserIdRowClaimer("Test", claim, 2);
    const caller = (n: number) => ({
      userId: `user-${n}`,
      near: { primaryAccountId: `${n}.near` },
    });
    await run(caller(1));
    await run(caller(2));
    await run(caller(3)); // full: clears, then holds only caller 3
    await run(caller(3));
    expect(claim).toHaveBeenCalledTimes(3);
    await run(caller(1)); // forgotten, so it is claimed again
    expect(claim).toHaveBeenCalledTimes(4);
  });

  it("skips callers without a linked account", async () => {
    const claim = vi.fn(async () => {});
    const run = createUserIdRowClaimer("Test", claim);
    await run({ userId: "user-fern" });
    await run({ userId: "fern.near", near: { primaryAccountId: "fern.near" } });
    expect(claim).not.toHaveBeenCalled();
  });

  it("swallows a failure and retries on the next request", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const claim = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue();
    const run = createUserIdRowClaimer("Test", claim);

    await expect(run(linked)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    await run(linked);
    await run(linked);
    expect(claim).toHaveBeenCalledTimes(2);
  });
});
