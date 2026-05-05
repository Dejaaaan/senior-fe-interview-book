import { createServer } from "node:http";

type Subscriber = { id: number; res: import("node:http").ServerResponse };

const subscribers = new Set<Subscriber>();
let nextId = 1;

const server = createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end();
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/events")) {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "access-control-allow-origin": "*",
      "x-accel-buffering": "no",
    });
    res.write("retry: 5000\n\n");

    const url = new URL(req.url, `http://${req.headers.host}`);
    const lastId = Number(req.headers["last-event-id"] ?? url.searchParams.get("lastId") ?? 0);
    if (lastId > 0) {
      res.write(`event: replay\nid: ${lastId}\ndata: ${JSON.stringify({ from: lastId })}\n\n`);
    }

    const sub: Subscriber = { id: nextId++, res };
    subscribers.add(sub);

    const ping = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`);
    }, 25_000);

    req.on("close", () => {
      clearInterval(ping);
      subscribers.delete(sub);
    });
    return;
  }

  if (req.method === "POST" && req.url === "/publish") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let payload: { type: string; data: unknown };
      try {
        payload = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        res.end();
        return;
      }
      const id = Date.now();
      const eventStr = `id: ${id}\nevent: ${payload.type}\ndata: ${JSON.stringify(payload.data)}\n\n`;
      for (const s of subscribers) s.res.write(eventStr);
      res.statusCode = 204;
      res.end();
    });
    return;
  }

  res.statusCode = 404;
  res.end();
});

const PORT = Number(process.env.PORT ?? 8082);
server.listen(PORT, () => {
  console.log(`SSE server listening on :${PORT}`);
});
