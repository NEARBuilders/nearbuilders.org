import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ideaDraft = {
  kind: "idea" as const,
  title: "A saved idea",
  content: "# Details",
  visibility: "public" as const,
};

function createStorage() {
  return {
    getItem: vi.fn((_key: string): string | null => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

describe("draft persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports saving and saved around the debounced storage write", async () => {
    const storage = createStorage();
    vi.stubGlobal("localStorage", storage);
    const { setDraft, subscribeToDraftPersistence } = await import("./draft-store");
    const statuses: string[] = [];
    const unsubscribe = subscribeToDraftPersistence("idea", (status) => statuses.push(status));

    setDraft("idea", ideaDraft);

    expect(statuses).toEqual(["saving"]);
    expect(storage.setItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(storage.setItem).toHaveBeenCalledWith("projects:new:v2:idea", JSON.stringify(ideaDraft));
    expect(statuses).toEqual(["saving", "saved"]);
    unsubscribe();
  });

  it("reports an error when browser storage rejects the draft", async () => {
    const storage = createStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    vi.stubGlobal("localStorage", storage);
    const { setDraft, subscribeToDraftPersistence } = await import("./draft-store");
    const statuses: string[] = [];
    const unsubscribe = subscribeToDraftPersistence("idea", (status) => statuses.push(status));

    setDraft("idea", ideaDraft);
    await vi.advanceTimersByTimeAsync(300);

    expect(statuses).toEqual(["saving", "error"]);
    unsubscribe();
  });

  it("drops legacy drafts and ignores drafts saved for another kind", async () => {
    const storage = createStorage();
    storage.getItem.mockImplementation((key: string) =>
      key === "projects:new:v2:idea" ? JSON.stringify({ ...ideaDraft, kind: "project" }) : null,
    );
    vi.stubGlobal("localStorage", storage);
    const { getDraft } = await import("./draft-store");

    expect(getDraft("idea")).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith("projects:new:idea");
  });

  it("restores a draft saved under the current key", async () => {
    const storage = createStorage();
    storage.getItem.mockImplementation((key: string) =>
      key === "projects:new:v2:idea" ? JSON.stringify(ideaDraft) : null,
    );
    vi.stubGlobal("localStorage", storage);
    const { getDraft } = await import("./draft-store");

    expect(getDraft("idea")).toEqual(ideaDraft);
  });

  it("returns no draft when browser storage is unavailable during SSR", async () => {
    const { getDraft } = await import("./draft-store");

    expect(getDraft("idea")).toBeNull();
  });

  it("persists only the latest draft during rapid edits", async () => {
    const storage = createStorage();
    vi.stubGlobal("localStorage", storage);
    const { setDraft } = await import("./draft-store");

    setDraft("idea", { ...ideaDraft, title: "First title" });
    await vi.advanceTimersByTimeAsync(100);
    setDraft("idea", { ...ideaDraft, title: "Latest title" });
    await vi.advanceTimersByTimeAsync(300);

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      "projects:new:v2:idea",
      JSON.stringify({ ...ideaDraft, title: "Latest title" }),
    );
  });
});
