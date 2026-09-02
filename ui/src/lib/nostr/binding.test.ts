import { generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";
import { createBindingChallenge, signBindingChallenge } from "./binding";

describe("binding helpers", () => {
  it("creates a well-formed challenge with future expiry", () => {
    const { challenge, expiresAt } = createBindingChallenge("buidlguidl.near");

    expect(challenge).toBe(`bind:buidlguidl.near:${expiresAt}:nostr.nearbuilders.org`);
    expect(expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("signs a verifiable kind-27235 event containing the challenge", () => {
    const sk = generateSecretKey();
    const { challenge } = createBindingChallenge("buidlguidl.near");
    const event = signBindingChallenge(sk, challenge);

    expect(event.content).toBe(challenge);
    expect(event.pubkey).toBe(getPublicKey(sk));
    expect(event.tags).toContainEqual(["challenge", challenge]);
    expect(verifyEvent(event as never)).toBe(true);
  });
});
