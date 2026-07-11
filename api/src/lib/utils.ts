import { ORPCError } from "every-plugin/orpc";

export function requireObjectPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ORPCError("BAD_REQUEST", { message: "Proposal payload must be an object" });
  }
  return payload as Record<string, unknown>;
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}
