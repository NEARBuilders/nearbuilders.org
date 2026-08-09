/**
 * Effect context bridge for nostr-bindings plugin.
 */

import { Cause, Effect, Exit } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import type { AuthContext } from "./auth.js";

export const ContextSchema = z.custom<AuthContext>();

export type Context = AuthContext;

export async function runEffect<A>(effect: Effect.Effect<A, unknown>) {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isFailure(exit)) {
    const squashed = Cause.squash(exit.cause);
    if (squashed instanceof ORPCError) {
      throw squashed;
    }

    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: squashed instanceof Error ? squashed.message : String(squashed),
    });
  }

  return exit.value;
}
