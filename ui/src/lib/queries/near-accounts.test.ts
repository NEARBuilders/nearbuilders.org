import { describe, expect, it, vi } from "vitest";
import type { AuthClient } from "@/app";
import { nearAccountsOptions } from "./near-accounts";

describe("nearAccountsOptions", () => {
  it("returns all linked accounts and the active account", async () => {
    const data = {
      accounts: [
        {
          id: "near-1",
          userId: "user-1",
          accountId: "alice.near",
          network: "mainnet" as const,
          publicKey: "ed25519:key",
          isPrimary: true,
          createdAt: new Date(),
          providerId: "siwn" as const,
          isActive: true,
          isAvailable: false,
        },
      ],
      activeAccount: null,
      availableAccounts: [],
    };
    const authClient = {
      near: { listAccounts: vi.fn().mockResolvedValue({ data, error: null }) },
    } as unknown as AuthClient;

    await expect(nearAccountsOptions(authClient).queryFn()).resolves.toEqual(data);
  });

  it("surfaces account-list errors", async () => {
    const authClient = {
      near: {
        listAccounts: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Could not list accounts" },
        }),
      },
    } as unknown as AuthClient;

    await expect(nearAccountsOptions(authClient).queryFn()).rejects.toThrow(
      "Could not list accounts",
    );
  });
});
