import { NearConnector } from "@hot-labs/near-connect";
import { generateNonce } from "near-kit";
import type { ApiClient } from "@/app";

export const NEAR_AI_LOGIN_MESSAGE = "Sign in to NEAR AI Cloud" as const;
export const NEAR_AI_LOGIN_RECIPIENT = "cloud.near.ai" as const;

export type NearAiLoginInput = Parameters<ApiClient["credits"]["loginNearAi"]>[0];

export type NearAiSignedMessage = {
  accountId: string;
  publicKey: string;
  signature: string;
};

export type Nep413Signer = {
  signMessage(params: {
    message: string;
    recipient: string;
    nonce: Uint8Array;
  }): Promise<NearAiSignedMessage>;
};

let connectorClient: Promise<NearConnector> | null = null;

function connector(): Promise<NearConnector> {
  connectorClient ??= Promise.resolve(new NearConnector({ network: "mainnet" }));
  return connectorClient;
}

async function walletFor(
  expectedAccountId: string,
): Promise<Awaited<ReturnType<NearConnector["getConnectedWallet"]>>["wallet"]> {
  const connection = await connector();
  const connected = await connection.getConnectedWallet().catch(() => null);
  const account = connected?.accounts?.[0];
  const signingAccount =
    account && account.accountId.toLowerCase() === expectedAccountId.toLowerCase()
      ? account
      : await connectAccount(connection, expectedAccountId);
  if (!signingAccount) {
    throw new Error(`Connect ${expectedAccountId} in your wallet to continue`);
  }
  const wallet =
    (connected?.accounts?.[0]?.accountId === signingAccount.accountId ? connected?.wallet : null) ??
    (await connection.getConnectedWallet()).wallet;
  return wallet;
}

function connectAccount(
  connection: NearConnector,
  expectedAccountId: string,
): Promise<{ accountId: string } | null> {
  return new Promise((resolve) => {
    const signInHandler = (data: {
      accounts?: Array<{ accountId: string; publicKey?: string }>;
    }) => {
      const account = data.accounts?.[0];
      if (account?.accountId.toLowerCase() === expectedAccountId.toLowerCase()) {
        cleanup();
        resolve(account);
      }
    };
    const cleanup = () => {
      connection.off("wallet:signIn", signInHandler);
    };
    connection.on("wallet:signIn", signInHandler);
    connection
      .connect()
      .then(() => {
        connection
          .getConnectedWallet()
          .then((result) => {
            const account = result.accounts?.[0];
            resolve(
              account && account.accountId.toLowerCase() === expectedAccountId.toLowerCase()
                ? account
                : null,
            );
          })
          .catch(() => resolve(null))
          .finally(cleanup);
      })
      .catch(() => {
        cleanup();
        resolve(null);
      });
  });
}

export function buildNearAiLoginInput(
  signer: Nep413Signer,
  expectedAccountId: string,
  nonce: Uint8Array = generateNonce(),
): Promise<NearAiLoginInput> {
  const expected = expectedAccountId.trim().toLowerCase();
  if (!expected) {
    return Promise.reject(new Error("Set the NEAR AI login account in credits settings first"));
  }
  const payload = { message: NEAR_AI_LOGIN_MESSAGE, recipient: NEAR_AI_LOGIN_RECIPIENT, nonce };
  return signer.signMessage(payload).then((signed) => {
    if (signed.accountId.trim().toLowerCase() !== expected) {
      throw new Error(
        `Wallet signed as ${signed.accountId} — connect ${expectedAccountId.trim()} instead`,
      );
    }
    return {
      signedMessage: {
        accountId: signed.accountId,
        publicKey: signed.publicKey,
        signature: signed.signature,
      },
      payload: {
        message: payload.message,
        nonce: Array.from(nonce),
        recipient: payload.recipient,
      },
    };
  });
}

export function signNearAiLogin(expectedAccountId: string): Promise<NearAiLoginInput> {
  const expected = expectedAccountId.trim().toLowerCase();
  if (!expected) {
    return Promise.reject(new Error("Set the NEAR AI login account in credits settings first"));
  }
  return walletFor(expected).then((wallet) =>
    buildNearAiLoginInput(
      {
        signMessage: (params) =>
          wallet.signMessage({
            message: params.message,
            recipient: params.recipient,
            nonce: params.nonce,
            network: "mainnet",
          }),
      },
      expected,
    ),
  );
}
