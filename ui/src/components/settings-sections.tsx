import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, KeyRound, Server, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type Passkey, useAuthClient } from "@/app";
import {
  ApiKeyForm,
  type ApiKeyFormValues,
  ApiKeyReveal,
  type ApiKeyRevealProps,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
} from "@/components";
import { Input } from "@/components/ui/input";

type CreatedApiKey = ApiKeyRevealProps["apiKey"];

type ApiKeyItem = {
  id: string;
  name: string | null;
  prefix: string | null;
  start: string | null;
  enabled?: boolean;
  createdAt: string | Date;
  expiresAt?: string | Date | null;
  lastRequest?: string | Date | null;
};

export function useUserPasskeys(enabled = true) {
  const auth = useAuthClient();
  const passkeyQueryKey = ["passkeys"] as const;

  return useQuery({
    queryKey: passkeyQueryKey,
    queryFn: async () => {
      const { data } = await auth.passkey.listUserPasskeys();
      return (data || []) as Passkey[];
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function AuthMethodsPanel({
  user,
  passkeys,
  nearAccountId,
}: {
  user: {
    id: string;
    email?: string;
    phoneNumber?: string | null;
    phoneNumberVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
  passkeys: Array<{ id: string; name?: string }>;
  nearAccountId: string | null;
}) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const [passkeyName, setPasskeyName] = useState("");
  const [passkeyToDelete, setPasskeyToDelete] = useState<{ id: string; name?: string } | null>(
    null,
  );
  const passkeyQueryKey = ["passkeys"] as const;
  const phoneNumber = user.phoneNumber ?? null;

  const addPasskeyMutation = useMutation({
    mutationFn: async () => {
      const name = passkeyName.trim();
      const { error } = name
        ? await auth.passkey.addPasskey({ name })
        : await auth.passkey.addPasskey();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPasskeyName("");
      toast.success("Passkey added");
      queryClient.invalidateQueries({ queryKey: passkeyQueryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removePasskeyMutation = useMutation({
    mutationFn: async (passkeyId: string) => {
      const { error } = await auth.passkey.deletePasskey({ id: passkeyId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPasskeyToDelete(null);
      toast.success("Passkey removed");
      queryClient.invalidateQueries({ queryKey: passkeyQueryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkNearMutation = useMutation({
    mutationFn: async () => {
      const result: unknown = await auth.signIn.near();
      if (
        result &&
        typeof result === "object" &&
        "error" in result &&
        result.error &&
        typeof result.error === "object" &&
        "message" in result.error
      ) {
        throw new Error(String(result.error.message));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
      queryClient.invalidateQueries({ queryKey: ["near-accounts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MethodCard title="email" status={user.email ? "linked" : "missing"}>
          <p className={`text-sm text-muted-foreground${user.email ? " break-all" : ""}`}>
            {user.email ?? "Email login has not been linked for this account yet."}
          </p>
        </MethodCard>

        <MethodCard
          title="phone"
          status={phoneNumber ? (user.phoneNumberVerified ? "verified" : "linked") : "available"}
        >
          <p className="text-sm text-muted-foreground">
            {phoneNumber ? phoneNumber : "Phone OTP sign-in is available from the login screen."}
          </p>
        </MethodCard>

        <MethodCard title="near" status={nearAccountId ? "linked" : "missing"}>
          {nearAccountId ? (
            <div className="border border-border bg-muted p-3 font-mono text-xs break-all">
              {nearAccountId}
            </div>
          ) : (
            <Button
              onClick={() => linkNearMutation.mutate()}
              disabled={linkNearMutation.isPending}
              variant="outline"
              size="sm"
            >
              {linkNearMutation.isPending ? "redirecting..." : "link NEAR wallet"}
            </Button>
          )}
        </MethodCard>

        <MethodCard
          title="passkeys"
          status={passkeys.length > 0 ? `${passkeys.length} linked` : "missing"}
        >
          <div className="space-y-2">
            {passkeys.length > 0 ? (
              passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="border border-border bg-muted p-3 flex items-center justify-between gap-3"
                >
                  <span className="text-sm truncate min-w-0 flex-1">
                    {passkey.name || "Passkey"}
                  </span>
                  <Button
                    onClick={() => setPasskeyToDelete(passkey)}
                    disabled={removePasskeyMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    remove
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
            )}
            <Input
              type="text"
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              placeholder="Passkey name, e.g. Work laptop"
            />
            <Button
              onClick={() => addPasskeyMutation.mutate()}
              disabled={addPasskeyMutation.isPending}
              variant="outline"
              size="sm"
            >
              {addPasskeyMutation.isPending ? "adding..." : "add passkey"}
            </Button>
          </div>
        </MethodCard>
      </div>
      <ConfirmDialog
        open={!!passkeyToDelete}
        onOpenChange={(open: boolean) => {
          if (!open) setPasskeyToDelete(null);
        }}
        title="Remove passkey"
        description={`Remove ${passkeyToDelete?.name || "this passkey"} from your account? You will no longer be able to use it to sign in.`}
        confirmLabel="remove"
        variant="destructive"
        onConfirm={() => {
          if (passkeyToDelete) {
            removePasskeyMutation.mutate(passkeyToDelete.id);
          }
        }}
        isPending={removePasskeyMutation.isPending}
      />
    </>
  );
}

export function UserApiKeysPanel() {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const [createdApiKey, setCreatedApiKey] = useState<CreatedApiKey | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ title: "", description: "", onConfirm: () => {} });

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["user-api-keys"],
    queryFn: async (): Promise<ApiKeyItem[]> => {
      const { data, error } = await auth.apiKey.list({
        query: { configId: "user-keys" },
      });
      if (error) throw new Error(error.message);
      return (data?.apiKeys ?? []) as ApiKeyItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ApiKeyFormValues) => {
      const { data, error } = await auth.apiKey.create({
        configId: "user-keys",
        name: values.name,
        ...(values.expiresIn !== undefined ? { expiresIn: values.expiresIn } : {}),
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      if (data) setCreatedApiKey(data as CreatedApiKey);
      toast.success("API key created");
      queryClient.invalidateQueries({ queryKey: ["user-api-keys"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create API key"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await auth.apiKey.delete({ keyId, configId: "user-keys" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setConfirmOpen(false);
      toast.success("API key deleted");
      queryClient.invalidateQueries({ queryKey: ["user-api-keys"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete API key"),
  });

  const handleDelete = (keyId: string, keyName: string | null) => {
    setConfirmConfig({
      title: "Delete API key",
      description: `Permanently revoke ${keyName ?? "this key"}. Any service using it will stop working.`,
      onConfirm: () => {
        deleteMutation.mutate(keyId);
      },
    });
    setConfirmOpen(true);
  };

  const enabledKeys = apiKeys.filter((key) => key.enabled !== false).length;
  const disabledKeys = apiKeys.length - enabledKeys;

  return (
    <div className="space-y-5">
      <ApiKeysSummary total={apiKeys.length} enabled={enabledKeys} disabled={disabledKeys} />

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-5 space-y-1">
          <h2 className="text-base font-semibold leading-tight text-foreground">
            Create personal API key
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Create a key for a specific trusted tool, then store the secret somewhere safe.
          </p>
        </div>
        <div className="max-w-2xl">
          <ApiKeyForm
            onCreate={(values: ApiKeyFormValues) => createMutation.mutate(values)}
            isPending={createMutation.isPending}
          />
        </div>
      </div>

      {createdApiKey && (
        <ApiKeyReveal apiKey={createdApiKey} onDismiss={() => setCreatedApiKey(null)} />
      )}

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold leading-tight text-foreground">
              Personal API keys
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Revoke keys that are no longer used. Full key secrets are only shown once.
            </p>
          </div>
          <Badge variant={enabledKeys > 0 ? "success" : "secondary"}>{enabledKeys} active</Badge>
        </div>

        {isLoading ? (
          <ApiKeysLoadingState />
        ) : apiKeys.length > 0 ? (
          <div className="flex flex-col gap-2">
            {apiKeys.map((key) => (
              <ApiKeyListRow
                key={key.id}
                apiKey={key}
                onDelete={() => handleDelete(key.id, key.name)}
                disabled={deleteMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <ApiKeysEmptyState />
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmConfig.title}
        description={confirmConfig.description}
        variant="destructive"
        onConfirm={confirmConfig.onConfirm}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function ApiKeysSummary({
  total,
  enabled,
  disabled,
}: {
  total: number;
  enabled: number;
  disabled: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-tight text-foreground">API access</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Personal keys let external tools call NEAR Builders APIs using your account.
            </p>
          </div>
        </div>
        {total > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant={enabled > 0 ? "success" : "secondary"}>{enabled} active</Badge>
            <Badge variant={disabled > 0 ? "outline" : "secondary"}>{disabled} disabled</Badge>
            <Badge variant="secondary">{total} total</Badge>
          </div>
        ) : (
          <Badge variant="secondary">No keys</Badge>
        )}
      </div>
    </div>
  );
}

function ApiKeyListRow({
  apiKey,
  onDelete,
  disabled,
}: {
  apiKey: ApiKeyItem;
  onDelete: () => void;
  disabled: boolean;
}) {
  const isEnabled = apiKey.enabled !== false;

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-muted px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 truncate font-semibold text-foreground">
            {apiKey.name ?? "Unnamed key"}
          </div>
          <Badge variant={isEnabled ? "success" : "outline"}>
            {isEnabled ? "Active" : "Disabled"}
          </Badge>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {apiKey.prefix ?? "api_"}...{apiKey.start ?? ""}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Created {formatApiKeyDate(apiKey.createdAt)}
          </span>
          {apiKey.expiresAt && <span>Expires {formatApiKeyDate(apiKey.expiresAt)}</span>}
          {apiKey.lastRequest && <span>Last used {formatApiKeyDate(apiKey.lastRequest)}</span>}
        </div>
      </div>
      <Button
        onClick={onDelete}
        disabled={disabled}
        variant="outline"
        size="sm"
        className="justify-self-start text-destructive hover:text-destructive sm:justify-self-auto"
      >
        <Trash2 className="h-3.5 w-3.5" />
        delete
      </Button>
    </div>
  );
}

function ApiKeysLoadingState() {
  return (
    <div className="rounded-lg border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
      Loading API keys...
    </div>
  );
}

function ApiKeysEmptyState() {
  return (
    <div className="rounded-lg border border-border bg-muted/60 px-4 py-6">
      <div className="flex gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <Server className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-foreground">No personal API keys</div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Create a key when an integration or local tool needs API access.
          </p>
        </div>
      </div>
    </div>
  );
}

function formatApiKeyDate(value: string | Date) {
  return new Date(value).toLocaleString();
}

function MethodCard({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">{title}</div>
          <Badge variant="outline">{status}</Badge>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
