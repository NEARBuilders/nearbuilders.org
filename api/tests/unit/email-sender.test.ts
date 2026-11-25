import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailSender } from "../../src/services/email";

const message = { to: "builder@example.com", subject: "Hello", text: "Body" };

function abortable(signal: AbortSignal | null | undefined) {
  return new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("email sender", () => {
  it("gives up on a provider that never answers", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => abortable(init?.signal));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const send = createEmailSender({ apiKey: "key", from: "from@example.com", timeoutMs: 20 });

    await expect(send(message)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends through Resend and reports success", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const send = createEmailSender({ apiKey: "key", from: "from@example.com" });

    await expect(send(message)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "from@example.com",
      to: ["builder@example.com"],
      subject: "Hello",
      text: "Body",
    });
  });

  it("reports a provider error without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad", { status: 500 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const send = createEmailSender({ apiKey: "key", from: "from@example.com" });

    await expect(send(message)).resolves.toBe(false);
  });

  it("skips sending when no API key is set", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const send = createEmailSender({ apiKey: "", from: "from@example.com" });

    await expect(send(message)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
