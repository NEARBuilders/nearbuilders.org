import { ORPCError } from "every-plugin/orpc";
import { AccountIdSchema } from "near-kit/schemas";

const IMPLICIT_ACCOUNT_ID_RE = /^[0-9a-f]{64}$/;

export function assertValidBuilderProposalAccount(input: { pluginId: string; entityId: string }) {
  if (input.pluginId !== "builders") return;

  if (!AccountIdSchema.safeParse(input.entityId).success) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Invalid NEAR account ID",
    });
  }

  if (IMPLICIT_ACCOUNT_ID_RE.test(input.entityId)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Builder nominations require a named NEAR account ID",
    });
  }
}
