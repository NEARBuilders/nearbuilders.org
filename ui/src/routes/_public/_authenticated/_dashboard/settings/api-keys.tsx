import { createFileRoute } from "@tanstack/react-router";
import { UserApiKeysPanel } from "@/components/settings-sections";

export const Route = createFileRoute("/_public/_authenticated/_dashboard/settings/api-keys")({
  component: ApiKeysSettings,
});

function ApiKeysSettings() {
  return <UserApiKeysPanel />;
}
