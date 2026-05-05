import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

type ChatMessage = {
  type: "message";
  user: string;
  text: string;
  ts: number;
};

const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://localhost:3000"]);

const http = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("WS server up\n");
});

const wss = new WebSocketServer({ noServer: true });
const clients = new Set<WebSocket>();

http.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws) => {
  clients.add(ws);

  ws.on("message", (raw) => {
    let parsed: ChatMessage;
    try {
      parsed = { ...(JSON.parse(String(raw)) as ChatMessage), ts: Date.now() };
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
      return;
    }
    const payload = JSON.stringify(parsed);
    for (const client of clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  });

  ws.on("close", () => clients.delete(ws));

  const heartbeat = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping();
  }, 30_000);
  ws.on("close", () => clearInterval(heartbeat));
});

const PORT = Number(process.env.PORT ?? 8081);
http.listen(PORT, () => {
  console.log(`WS server listening on :${PORT}`);
});
