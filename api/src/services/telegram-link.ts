import { createHash, randomBytes } from "node:crypto";
import { ORPCError } from "every-plugin/orpc";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import { evaluatorContext } from "./review-context";

export const TELEGRAM_LINK_TTL_MS = 10 * 60 * 1000;
export const TELEGRAM_LINK_PATH = "/admin/telegram-link";

type Plugins = Pick<PluginsClient, "proposals">;

export function hashLinkCode(code: string): string {
  return createHash("sha256").update(code).digest("base64url");
}

function reviewers(plugins: Plugins) {
  return plugins.proposals(evaluatorContext);
}

export async function createTelegramLink(
  plugins: Plugins,
  input: { telegramId: number; username?: string | null; name?: string | null },
) {
  const code = randomBytes(32).toString("base64url");
  const { expiresAt } = await reviewers(plugins).createTelegramLinkCode({
    codeHash: hashLinkCode(code),
    telegramId: input.telegramId,
    telegramUsername: input.username ?? null,
    telegramName: input.name ?? null,
    ttlMs: TELEGRAM_LINK_TTL_MS,
  });
  const current = await reviewers(plugins).getTelegramReviewer({ telegramId: input.telegramId });
  return {
    path: `${TELEGRAM_LINK_PATH}?code=${code}`,
    expiresAt,
    alreadyLinked: current.data !== null,
  };
}

export async function previewTelegramLink(plugins: Plugins, code: string, context: Context) {
  const pending = await reviewers(plugins).getTelegramLinkCode({ codeHash: hashLinkCode(code) });
  if (!pending.data) {
    throw new ORPCError("NOT_FOUND", {
      message: "This link has expired. Send /link to Chief again.",
    });
  }
  const telegramId = pending.data.telegramId;
  const [current, own] = await Promise.all([
    reviewers(plugins).getTelegramReviewer({ telegramId }),
    context.userId
      ? reviewers(plugins).getTelegramReviewerByUser({ userId: context.userId })
      : Promise.resolve({ data: null }),
  ]);
  const replaced = own.data && own.data.telegramId !== telegramId ? own.data : null;
  return {
    ...pending.data,
    linkedAs:
      current.data && current.data.userId !== context.userId ? current.data.userLabel : null,
    replaces: replaced
      ? {
          telegramId: replaced.telegramId,
          telegramUsername: replaced.telegramUsername,
          telegramName: replaced.telegramName,
        }
      : null,
  };
}

export function reviewerLabel(context: Context): string {
  return context.near?.primaryAccountId ?? context.user?.name ?? context.userId ?? "admin";
}

export async function confirmTelegramLink(plugins: Plugins, code: string, context: Context) {
  if (!context.userId) {
    throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
  }
  return await reviewers(plugins).linkTelegramReviewer({
    codeHash: hashLinkCode(code),
    userId: context.userId,
    userLabel: reviewerLabel(context),
  });
}

export async function findTelegramReviewer(plugins: Plugins, telegramId: number) {
  const result = await reviewers(plugins).getTelegramReviewer({ telegramId });
  return result.data;
}

export async function listTelegramReviewers(plugins: Plugins) {
  return await reviewers(plugins).listTelegramReviewers({});
}

export async function removeTelegramReviewer(plugins: Plugins, telegramId: number) {
  return await reviewers(plugins).removeTelegramReviewer({ telegramId });
}
