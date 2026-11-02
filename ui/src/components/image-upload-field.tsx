import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useApiClient, useAuthClient } from "@/app";
import { Button } from "@/components/ui/button";
import {
  IMAGE_UPLOAD_ACCEPT,
  imageUploadErrorMessage,
  MAX_IMAGE_UPLOAD_BYTES,
  uploadImage,
  validateImageFile,
} from "@/lib/image-upload";
import { isSafeImageUrl } from "@/lib/image-url";
import { getNearSocialAvatarUrl } from "@/lib/near-social";
import { nearProfileOptions } from "@/lib/queries/builders";
import { cn } from "@/lib/utils";

export function ImageUploadField({
  id,
  value,
  onChange,
  onBlur,
  fallbackAccount,
  fallbackLabel,
  shape = "square",
  error,
  invalidClassName,
}: {
  id: string;
  value: string | undefined;
  onChange: (url: string) => void;
  onBlur?: () => void;
  fallbackAccount?: string | null;
  fallbackLabel?: string;
  shape?: "square" | "round";
  error?: string;
  invalidClassName?: string;
}) {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  const current = isSafeImageUrl(value) ? value.trim() : undefined;
  const { data: fallbackProfile } = useQuery({
    ...nearProfileOptions(auth, fallbackAccount ?? ""),
    enabled: Boolean(fallbackAccount) && !current,
  });
  const fallbackUrl = getNearSocialAvatarUrl(fallbackProfile);
  const fallback = !current && isSafeImageUrl(fallbackUrl) ? fallbackUrl : undefined;
  const preview = current ?? fallback;
  const message = uploadError ?? error;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setUploadError(invalid);
      onBlur?.();
      return;
    }
    setUploadError(undefined);
    setUploading(true);
    try {
      const url = await uploadImage(apiClient.storage, file);
      onChange(url);
    } catch (err) {
      setUploadError(imageUploadErrorMessage(err));
    } finally {
      setUploading(false);
      onBlur?.();
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted",
            shape === "round" ? "rounded-full" : "rounded-2xl",
            message && "border-destructive",
            !message && invalidClassName,
          )}
        >
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={IMAGE_UPLOAD_ACCEPT}
            className="sr-only"
            disabled={uploading}
            aria-invalid={Boolean(message)}
            aria-describedby={message ? `${id}-feedback` : `${id}-hint`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-4" aria-hidden="true" />
            )}
            {uploading ? "Uploading…" : current ? "Replace image" : "Upload image"}
          </Button>
          {current && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setUploadError(undefined);
                onChange("");
                onBlur?.();
              }}
            >
              <X className="size-4" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>
      {message ? (
        <p id={`${id}-feedback`} className="text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          PNG, JPEG, WebP or GIF, up to {MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)} MB.
          {fallback && fallbackLabel ? ` ${fallbackLabel}` : ""}
        </p>
      )}
    </div>
  );
}
