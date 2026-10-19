import { createHash, randomBytes } from "node:crypto";
import { ORPCError } from "every-plugin/orpc";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import { evaluatorContext } from "./review-context";

export const TELEGRAM_LINK_TTL_MS = 10 * 60 * 1000;
export const TELEGRAM_START_PREFIX = "link-";

type Plugins = Pick<PluginsClient, "proposals">;

export function hashLinkCode(code: string): string {
  return createHash("sha256").update(code).digest("base64url");
}

export function reviewerLabel(context: Context): string {
  return context.near?.primaryAccountId ?? context.user?.name ?? context.userId ?? "admin";
}

export function requireAdminKeyOwner(context: Context): void {
  if (context.user?.role !== "admin") {
    throw new ORPCError("FORBIDDEN", {
      message: "Chief's API key must belong to a nearbuilders.org admin account",
    });
  }
}

export async function createTelegramLinkCode(
  plugins: Plugins,
  context: Context,
  options: { botUsername: string },
) {
  if (!context.userId) {
    throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
  }
  const code = randomBytes(24).toString("base64url");
  const { expiresAt } = await plugins.proposals(evaluatorContext).createTelegramLinkCode({
    codeHash: hashLinkCode(code),
    userId: context.userId,
    userLabel: reviewerLabel(context),
    ttlMs: TELEGRAM_LINK_TTL_MS,
  });
  return {
    code,
    command: `/link ${code}`,
    expiresAt,
    openUrl: options.botUsername
      ? `https://t.me/${options.botUsername}?start=${TELEGRAM_START_PREFIX}${code}`
      : null,
  };
}

export async function claimTelegramLink(
  plugins: Plugins,
  input: { code: string; telegramId: number; username?: string | null; name?: string | null },
) {
  const linked = await plugins.proposals(evaluatorContext).linkTelegramReviewer({
    codeHash: hashLinkCode(input.code),
    telegramId: input.telegramId,
    telegramUsername: input.username ?? null,
    telegramName: input.name ?? null,
  });
  return { userLabel: linked.data.userLabel };
}
