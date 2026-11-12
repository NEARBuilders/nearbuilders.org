import { createServer, type IncomingHttpHeaders } from "node:http";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/node";
import type { ActivityApiClient } from "../services/activity-api";

type CallInfo = { headers: IncomingHttpHeaders; lastEventId?: string; signal?: AbortSignal };

type FakeHandler = (input: any, call: CallInfo) => unknown;

export type FakeActivityCall = {
  procedure: string;
  input: any;
  authorization: string | undefined;
  lastEventId: string | undefined;
};

export async function startFakeActivity(
  handlers: Partial<Record<keyof ActivityApiClient, FakeHandler>>,
) {
  const calls: FakeActivityCall[] = [];
  const base = os.$context<{ headers: IncomingHttpHeaders }>();
  const router = Object.fromEntries(
    Object.entries(handlers).map(([procedure, handle]) => [
      procedure,
      base.handler(({ input, context, lastEventId, signal }) => {
        calls.push({
          procedure,
          input,
          authorization: context.headers.authorization,
          lastEventId,
        });
        return handle?.(input, { headers: context.headers, lastEventId, signal });
      }),
    ]),
  );
  const handler = new RPCHandler(router);
  const server = createServer(async (request, response) => {
    const { matched } = await handler.handle(request, response, {
      prefix: "/api/rpc",
      context: { headers: request.headers },
    });
    if (!matched) {
      response.statusCode = 404;
      response.end("Not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fake Activity did not bind");
  const url = `http://127.0.0.1:${address.port}`;
  const client = createORPCClient<ActivityApiClient>(new RPCLink({ origin: url, url: "/api/rpc" }));
  return {
    url,
    client,
    calls,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
