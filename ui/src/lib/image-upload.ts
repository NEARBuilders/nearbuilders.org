export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export const IMAGE_UPLOAD_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");

export type ImageFile = Pick<File, "name" | "type" | "size">;

export function validateImageFile(file: ImageFile): string | undefined {
  const type = file.type.trim().toLowerCase();
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)) {
    return "Choose a PNG, JPEG, WebP or GIF image";
  }
  if (file.size <= 0) return "This file is empty";
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return `Images must be ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)} MB or smaller`;
  }
  return undefined;
}

export interface StorageUploadClient {
  requestUpload(input: { filename: string; contentType: string; sizeBytes: number }): Promise<{
    presignedUrl: string;
    key: string;
  }>;
  confirmUpload(input: { key: string }): Promise<{ publicUrl: string }>;
}

export async function uploadImage(
  storage: StorageUploadClient,
  file: File,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);

  const contentType = file.type.trim().toLowerCase();
  const upload = await storage.requestUpload({
    filename: file.name,
    contentType,
    sizeBytes: file.size,
  });

  const response = await fetchImpl(upload.presignedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!response.ok) {
    throw new Error(`Upload failed (status ${response.status})`);
  }

  const asset = await storage.confirmUpload({ key: upload.key });
  return asset.publicUrl;
}

export function imageUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (/not configured/i.test(error.message)) {
      return "Image uploads aren't available right now. Try again later.";
    }
    if (/NEAR wallet required/i.test(error.message)) {
      return "Sign in with a NEAR account to upload images";
    }
    return error.message;
  }
  return "Upload failed";
}
