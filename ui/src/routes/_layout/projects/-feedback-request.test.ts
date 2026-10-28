import { describe, expect, it } from "vitest";
import { feedbackRequestUrl } from "./-feedback-request";

describe("feedbackRequestUrl", () => {
  it("deep-links the project slug into the feedback request form", () => {
    expect(feedbackRequestUrl("near-builders")).toBe(
      "https://feedback.nearbuilders.org/feed/request?project=near-builders",
    );
  });

  it("encodes characters that are not safe in a query value", () => {
    expect(feedbackRequestUrl("safe near&5avcvo")).toBe(
      "https://feedback.nearbuilders.org/feed/request?project=safe+near%265avcvo",
    );
  });

  it("returns null when the slug is missing", () => {
    expect(feedbackRequestUrl("")).toBeNull();
    expect(feedbackRequestUrl("   ")).toBeNull();
    expect(feedbackRequestUrl(null)).toBeNull();
    expect(feedbackRequestUrl(undefined)).toBeNull();
  });
});
