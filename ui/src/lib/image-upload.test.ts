import { describe, expect, it, vi } from "vitest";
import {
  imageUploadErrorMessage,
  MAX_IMAGE_UPLOAD_BYTES,
  type StorageUploadClient,
  uploadImage,
  validateImageFile,
} from "./image-upload";

function imageFile(name: string, type: string, size: number) {
  const file = new File([new Uint8Array(Math.min(size, 16))], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function fakeStorage(): StorageUploadClient & {
  requestUpload: ReturnType<typeof vi.fn>;
  confirmUpload: ReturnType<typeof vi.fn>;
} {
  return {
    requestUpload: vi.fn(async () => ({
      presignedUrl: "https://bucket.example.com/upload?sig=1",
      key: "feedback/builder.near/abc-logo.png",
    })),
    confirmUpload: vi.fn(async () => ({
      publicUrl: "https://cdn.example.com/feedback/builder.near/abc-logo.png",
    })),
  };
}

describe("validateImageFile", () => {
  it.each(["image/png", "image/jpeg", "image/webp", "image/gif"])("accepts %s", (type) => {
    expect(validateImageFile(imageFile("logo", type, 1024))).toBeUndefined();
  });

  it.each(["image/svg+xml", "application/pdf", ""])("rejects %s", (type) => {
    expect(validateImageFile(imageFile("logo", type, 1024))).toBe(
      "Choose a PNG, JPEG, WebP or GIF image",
    );
  });

  it("rejects images over the size limit", () => {
    expect(validateImageFile(imageFile("big.png", "image/png", MAX_IMAGE_UPLOAD_BYTES + 1))).toBe(
      "Images must be 5 MB or smaller",
    );
    expect(
      validateImageFile(imageFile("ok.png", "image/png", MAX_IMAGE_UPLOAD_BYTES)),
    ).toBeUndefined();
  });

  it("rejects empty files", () => {
    expect(validateImageFile(imageFile("empty.png", "image/png", 0))).toBe("This file is empty");
  });
});

describe("uploadImage", () => {
  it("requests a signed URL, uploads the file, confirms it and returns the public URL", async () => {
    const storage = fakeStorage();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const file = imageFile("logo.png", "image/png", 2048);

    const url = await uploadImage(storage, file, fetchImpl as unknown as typeof fetch);

    expect(url).toBe("https://cdn.example.com/feedback/builder.near/abc-logo.png");
    expect(storage.requestUpload).toHaveBeenCalledWith({
      filename: "logo.png",
      contentType: "image/png",
      sizeBytes: 2048,
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://bucket.example.com/upload?sig=1", {
      method: "PUT",
      body: file,
      headers: { "Content-Type": "image/png" },
    });
    expect(storage.confirmUpload).toHaveBeenCalledWith({
      key: "feedback/builder.near/abc-logo.png",
    });
  });

  it("never calls the storage plugin for an invalid file", async () => {
    const storage = fakeStorage();
    const fetchImpl = vi.fn();

    await expect(
      uploadImage(
        storage,
        imageFile("doc.pdf", "application/pdf", 10),
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow("Choose a PNG, JPEG, WebP or GIF image");
    expect(storage.requestUpload).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not confirm when the upload to the bucket fails", async () => {
    const storage = fakeStorage();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 403 }));

    await expect(
      uploadImage(
        storage,
        imageFile("logo.png", "image/png", 10),
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow("Upload failed (status 403)");
    expect(storage.confirmUpload).not.toHaveBeenCalled();
  });

  it("passes the server's rejection through", async () => {
    const storage = fakeStorage();
    storage.requestUpload.mockRejectedValueOnce(new Error("File exceeds the 5 MB upload limit"));

    await expect(uploadImage(storage, imageFile("logo.png", "image/png", 10))).rejects.toThrow(
      "File exceeds the 5 MB upload limit",
    );
  });
});

describe("imageUploadErrorMessage", () => {
  it("explains an unconfigured storage backend", () => {
    expect(imageUploadErrorMessage(new Error("Storage is not configured"))).toBe(
      "Image uploads aren't available right now. Try again later.",
    );
  });

  it("asks for a NEAR account when the plugin requires one", () => {
    expect(imageUploadErrorMessage(new Error("NEAR wallet required"))).toBe(
      "Sign in with a NEAR account to upload images",
    );
  });

  it("falls back to a generic message", () => {
    expect(imageUploadErrorMessage("nope")).toBe("Upload failed");
  });
});
