import type { AuthClient } from "@/app";

type ApiKeysResponse = Awaited<ReturnType<AuthClient["apiKey"]["list"]>>;

export type ApiKeyItem = NonNullable<ApiKeysResponse["data"]>["apiKeys"][number];
