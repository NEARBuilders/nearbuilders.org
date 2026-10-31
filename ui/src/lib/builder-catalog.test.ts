import { describe, expect, it } from "vitest";
import {
  builderCatalogFromFormValues,
  builderCatalogToFormValues,
  emptyBuilderCatalog,
  getBuilderCatalogErrors,
  resolveBuilderAvatarUrl,
} from "./builder-catalog";

describe("builder catalog form values", () => {
  it("returns null when nothing is filled in", () => {
    expect(builderCatalogFromFormValues(emptyBuilderCatalog())).toBeNull();
    expect(
      builderCatalogFromFormValues({ ...emptyBuilderCatalog(), organization: "  " }),
    ).toBeNull();
  });

  it("round-trips stored details", () => {
    const catalog = {
      preferredContact: "Telegram" as const,
      organization: "Example Labs",
      jobTitle: "Engineer",
    };
    const values = builderCatalogToFormValues(catalog);
    expect(values.team).toBe("");
    expect(builderCatalogFromFormValues(values)).toEqual(catalog);
  });
});

describe("builder catalog validation", () => {
  it("needs the link that matches the preferred contact", () => {
    const values = { ...emptyBuilderCatalog(), preferredContact: "X" as const };
    expect(getBuilderCatalogErrors(values, {}).preferredContact).toBe(
      "Add your X link to use X as your preferred contact",
    );
    expect(getBuilderCatalogErrors(values, { twitter: "example" })).toEqual({});
  });

  it("needs a public email for email contact", () => {
    const values = { ...emptyBuilderCatalog(), preferredContact: "Email" as const };
    expect(getBuilderCatalogErrors(values, {}).preferredContact).toBe(
      "Add a public email to use email as your preferred contact",
    );
    expect(getBuilderCatalogErrors({ ...values, publicEmail: "builder@example.com" }, {})).toEqual(
      {},
    );
  });

  it("rejects bad email, avatar and long text", () => {
    expect(
      getBuilderCatalogErrors(
        {
          ...emptyBuilderCatalog(),
          publicEmail: "not-an-email",
          avatarUrl: "ftp://cdn.example.com/a.png",
          jobTitle: "a".repeat(81),
        },
        {},
      ),
    ).toEqual({
      publicEmail: "Enter a valid email address",
      avatarUrl: "Avatar URL must be an absolute http(s) URL",
      jobTitle: "Max 80 characters",
    });
  });
});

describe("resolveBuilderAvatarUrl", () => {
  const socialProfile = { image: { url: "https://ipfs.near.social/ipfs/bafy-avatar" } };

  it("prefers the uploaded avatar", () => {
    expect(
      resolveBuilderAvatarUrl("https://cdn.example.com/feedback/a.near/avatar.png", socialProfile),
    ).toBe("https://cdn.example.com/feedback/a.near/avatar.png");
  });

  it.each([
    "",
    null,
    undefined,
    "javascript:alert(1)",
    "not a url",
  ])("falls back to the NEAR Social avatar for %s", (value) => {
    expect(resolveBuilderAvatarUrl(value, socialProfile)).toBe(
      "https://ipfs.near.social/ipfs/bafy-avatar",
    );
  });

  it("returns null with neither", () => {
    expect(resolveBuilderAvatarUrl(null, null)).toBeNull();
  });
});
