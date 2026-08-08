import { describe, expect, it } from "vitest";
import { initializeNominationToken, shouldClearNominationToken } from "./nomination-token";

describe("Nomination browser state", () => {
  it("prefers and captures a URL token", () => {
    expect(initializeNominationToken(" new-token ", "stored-token")).toEqual({
      token: "new-token",
      capturedToken: "new-token",
      shouldCleanUrl: true,
    });
  });

  it("falls back to the stored token without replacing the URL", () => {
    expect(initializeNominationToken(undefined, " stored-token ")).toEqual({
      token: "stored-token",
      capturedToken: null,
      shouldCleanUrl: false,
    });
  });

  it("clears only invalid or submitted nominations", () => {
    expect(shouldClearNominationToken("invalid")).toBe(true);
    expect(shouldClearNominationToken("submitted")).toBe(true);
    expect(shouldClearNominationToken("ready")).toBe(false);
    expect(shouldClearNominationToken("error")).toBe(false);
  });
});
