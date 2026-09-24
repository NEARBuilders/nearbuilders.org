import { Copy, KeyRound, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export interface ApiKeyFormValues {
  name: string;
  expiresIn?: number;
}

interface ApiKeyFormProps {
  onCreate: (values: ApiKeyFormValues) => void;
  isPending: boolean;
}

const EXPIRATION_PRESETS = [
  { label: "no expiry", value: 0 },
  { label: "7 days", value: 7 * 24 * 60 * 60 },
  { label: "30 days", value: 30 * 24 * 60 * 60 },
  { label: "90 days", value: 90 * 24 * 60 * 60 },
  { label: "1 year", value: 365 * 24 * 60 * 60 },
] as const;

export function ApiKeyForm({ onCreate, isPending }: ApiKeyFormProps) {
  const [name, setName] = useState("");
  const [expiresInSeconds, setExpiresInSeconds] = useState<number>(0);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      expiresIn: expiresInSeconds > 0 ? expiresInSeconds : undefined,
    });
    setName("");
    setExpiresInSeconds(0);
  };

  return (
    <div className="space-y-4">
      {/* oxlint-disable-next-line shadcn/no-arbitrary-values -- flexible-input/fixed-button grid split; grid-template-columns has no scale equivalent */}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-2">
          <Label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
            Key name
          </Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Local CLI"
          />
        </div>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !name.trim()}
          variant={name.trim() ? "default" : "outline"}
          size="sm"
          className="sm:mb-0.5"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {isPending ? "creating..." : "create key"}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
          Expiration
        </Label>
        <div className="flex flex-wrap gap-2">
          {EXPIRATION_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              type="button"
              variant={expiresInSeconds === preset.value ? "default" : "outline"}
              size="sm"
              onClick={() => setExpiresInSeconds(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        API keys inherit your account access. Store secrets securely and revoke keys that are no
        longer used.
      </div>
    </div>
  );
}

export interface ApiKeyRevealProps {
  apiKey: {
    id: string;
    name: string | null;
    prefix: string | null;
    start: string | null;
    key: string;
    createdAt: string | Date;
  };
  onDismiss: () => void;
}

export function ApiKeyReveal({ apiKey, onDismiss }: ApiKeyRevealProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey.key);
      toast.success("API key copied");
    } catch {
      toast.error("Failed to copy API key");
    }
  };

  return (
    <Card>
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand-pink-soft bg-brand-pink-light">
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-foreground">New API key ready</div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Copy and store this key now. You will only be able to see the full secret once.
              </p>
            </div>
          </div>
          <Button onClick={onDismiss} variant="outline" size="sm" className="self-start">
            dismiss
          </Button>
        </div>

        {/* oxlint-disable-next-line shadcn/no-arbitrary-values -- flexible-input/fixed-button grid split; grid-template-columns has no scale equivalent */}
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            readOnly
            value={apiKey.key}
            className="font-mono text-xs"
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.currentTarget.select()}
          />
          <Button onClick={handleCopy} variant="outline" size="sm">
            <Copy className="h-3.5 w-3.5" />
            copy secret
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow label="Name" value={apiKey.name ?? "unnamed"} />
          <InfoRow label="Prefix" value={`${apiKey.prefix ?? "api_"}...`} mono />
          <InfoRow label="Created" value={new Date(apiKey.createdAt).toLocaleString()} />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    // oxlint-disable-next-line shadcn/no-arbitrary-values -- fixed-label/flexible-value grid split; grid-template-columns has no scale equivalent
    <div className="grid gap-1 rounded-md border border-border bg-muted px-3.5 py-3 sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-3">
      <div className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`min-w-0 break-all text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
