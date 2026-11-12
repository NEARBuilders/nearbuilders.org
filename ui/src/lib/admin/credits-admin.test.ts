import { describe, expect, it } from "vitest";
import type { CreditSettings } from "./credits-settings";
import { draftToInput, settingsDraft } from "./credits-settings";
import {
  buildNearAiLoginInput,
  NEAR_AI_LOGIN_MESSAGE,
  NEAR_AI_LOGIN_RECIPIENT,
  type Nep413Signer,
} from "./near-ai-session";

const NONCE = new Uint8Array(32).fill(7);

function signer(accountId: string): Nep413Signer {
  return {
    signMessage: async () => ({
      accountId,
      publicKey: "ed25519:test",
      signature: "ed25519:signature",
    }),
  };
}

describe("buildNearAiLoginInput", () => {
  it("builds the cloud-api login payload from a wallet signature", async () => {
    const input = await buildNearAiLoginInput(
      signer("nearbuilding.near"),
      "NearBuilding.near",
      NONCE,
    );
    expect(input).toEqual({
      signedMessage: {
        accountId: "nearbuilding.near",
        publicKey: "ed25519:test",
        signature: "ed25519:signature",
      },
      payload: {
        message: NEAR_AI_LOGIN_MESSAGE,
        nonce: Array.from(NONCE),
        recipient: NEAR_AI_LOGIN_RECIPIENT,
      },
    });
  });

  it("rejects a signature from a different account", async () => {
    await expect(
      buildNearAiLoginInput(signer("someone-else.near"), "nearbuilding.near", NONCE),
    ).rejects.toThrow("connect nearbuilding.near instead");
  });

  it("rejects without a configured login account", async () => {
    await expect(buildNearAiLoginInput(signer("nearbuilding.near"), "  ", NONCE)).rejects.toThrow(
      "Set the NEAR AI login account in credits settings first",
    );
  });
});

function settings(overrides: Partial<CreditSettings> = {}): CreditSettings {
  return {
    enabled: true,
    amountUsd: 5,
    claimsCloseAt: "2999-01-01T00:00:00.000Z",
    keyExpiresAt: "2999-02-01T00:00:00.000Z",
    nearAiWorkspaceId: "ws-hackathon",
    nearAiLoginAccountId: "nearbuilding.near",
    nearAiOrgId: "",
    updatedBy: "admin-user",
    updatedAt: "2026-10-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("settings draft", () => {
  it("starts from the saved settings in local datetime inputs", () => {
    const draft = settingsDraft(settings());
    expect(draft.enabled).toBe(true);
    expect(draft.amountUsd).toBe("5");
    expect(draft.nearAiWorkspaceId).toBe("ws-hackathon");
    expect(draft.claimsCloseAt).not.toBe("");
    expect(draft.keyExpiresAt).not.toBe("");
  });

  it("round-trips through the update input", () => {
    const input = draftToInput(settingsDraft(settings()));
    expect(input).toEqual({
      enabled: true,
      amountUsd: 5,
      claimsCloseAt: expect.any(String),
      keyExpiresAt: expect.any(String),
      nearAiWorkspaceId: "ws-hackathon",
      nearAiLoginAccountId: "nearbuilding.near",
      nearAiOrgId: "",
    });
    expect(new Date(input.claimsCloseAt ?? "").toISOString()).toBe("2999-01-01T00:00:00.000Z");
  });

  it("normalizes blanks and whitespace", () => {
    const draft = settingsDraft(null);
    draft.nearAiLoginAccountId = "  nearbuilding.near  ";
    const input = draftToInput(draft);
    expect(input).toEqual({
      enabled: false,
      amountUsd: 5,
      claimsCloseAt: null,
      keyExpiresAt: null,
      nearAiWorkspaceId: "",
      nearAiLoginAccountId: "nearbuilding.near",
      nearAiOrgId: "",
    });
  });
});
