/**
 * Local WebSocket relay proxy.
 * Forwards ws://localhost:9999/{relay-host}/{path} → wss://{relay-host}/{path}
 *
 * This exists because nearbuilders.org's CSP header only allows ws://localhost:*
 * but nostr-tools WebSocket pool tries to connect to wss://relay.damus.io etc.
 *
 * Usage: node relay-proxy.mjs
 * Then connect to: ws://localhost:9999/relay.damus.io
 */

import { WebSocketServer, WebSocket } from "ws";

const PROXY_PORT = 9999;
const ALLOWED_RELAYS = [
  "relay.damus.io",
  "nos.lol",
  "relay.primal.net",
];

const wss = new WebSocketServer({ port: PROXY_PORT });

wss.on("connection", (clientWs, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PROXY_PORT}`);
  const path = url.pathname + url.search;

  // Extract target relay from first path segment: /relay.damus.io/ → relay.damus.io
  const segments = path.split("/").filter(Boolean);
  if (!segments.length) {
    clientWs.close(4000, "No relay specified");
    return;
  }

  const relayHost = segments[0];
  const relayPath = segments.slice(1).join("/") || "/";
  const targetUrl = `wss://${relayHost}/${relayPath}`;

  if (!ALLOWED_RELAYS.includes(relayHost)) {
    clientWs.close(4003, `Relay ${relayHost} not allowed`);
    return;
  }

  console.log(`[${new Date().toISOString()}] ${relayHost} ← connect`);

  let serverWs;
  try {
    serverWs = new WebSocket(targetUrl);
  } catch (e) {
    clientWs.close(4004, `Failed to connect to ${targetUrl}`);
    return;
  }

  serverWs.on("open", () => {
    serverWs.on("message", (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    serverWs.on("close", (code, reason) => {
      console.log(`[${new Date().toISOString()}] ${relayHost} → closed (${code})`);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(code, reason);
      }
    });

    serverWs.on("error", (err) => {
      console.error(`[${new Date().toISOString()}] ${relayHost} error:`, err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(4005, err.message);
      }
    });
  });

  serverWs.on("error", (err) => {
    console.error(`[${new Date().toISOString()}] ${relayHost} connect failed:`, err.message);
    clientWs.close(4006, err.message);
  });

  clientWs.on("message", (data) => {
    if (serverWs.readyState === WebSocket.OPEN) {
      serverWs.send(data);
    }
  });

  clientWs.on("close", (code, reason) => {
    console.log(`[${new Date().toISOString()}] ${relayHost} ← closed (${code})`);
    if (serverWs.readyState === WebSocket.OPEN) {
      serverWs.close(code, reason);
    }
  });

  clientWs.on("error", (err) => {
    console.error(`[${new Date().toISOString()}] ${relayHost} client error:`, err.message);
    if (serverWs.readyState === WebSocket.OPEN) {
      serverWs.close(4007, err.message);
    }
  });
});

console.log(`Relay proxy listening on ws://localhost:${PROXY_PORT}`);
console.log(`Allowed relays: ${ALLOWED_RELAYS.join(", ")}`);
console.log(`Usage: ws://localhost:${PROXY_PORT}/relay.damus.io`);
