import { isNearAccountId } from "./normalize";

export function resolveProjectNearAccount(input: {
  ownerId?: string | null;
  apps?: Array<{ accountId?: string | null }> | null;
}): string | null {
  for (const app of input.apps ?? []) {
    if (isNearAccountId(app.accountId)) return app.accountId;
  }
  if (isNearAccountId(input.ownerId)) return input.ownerId;
  return null;
}
