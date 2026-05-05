---
title: "Real-time: WebSockets, SSE, WebRTC"
sidebar_label: "9.7 Real-time: WebSockets, SSE, WebRTC"
description: "Pick the right protocol for the right job: bidirectional, server-push, peer-to-peer."
sidebar_position: 7
---

Three protocols address the requirement that "the page updates without the user clicking refresh". Senior interviews probe whether the candidate knows which protocol fits which workload and why.

> **Acronyms used in this chapter.** AI: Artificial Intelligence. APNS: Apple Push Notification Service. CDN: Content Delivery Network. DB: Database. FCM: Firebase Cloud Messaging. HTTP: Hypertext Transfer Protocol. ICE: Interactive Connectivity Establishment. JSON: JavaScript Object Notation. NAT: Network Address Translation. P2P: Peer-to-Peer. SFU: Selective Forwarding Unit. SSE: Server-Sent Events. STUN: Session Traversal Utilities for NAT. TURN: Traversal Using Relays around NAT. UDP: User Datagram Protocol. WebRTC: Web Real-Time Communication. WS: WebSocket.

## A decision matrix

| Protocol | Direction | Transport | Reconnect | Auth | Use for |
| --- | --- | --- | --- | --- | --- |
| **Server-Sent Events (SSE)** | Server → client only | HTTP | Browser-native | Standard HTTP (cookies, headers) | Notifications, live feed, AI streaming |
| **WebSocket** | Bidirectional | WebSocket upgrade from HTTP | Manual | Cookie + custom subprotocol | Chat, collaboration, live cursors |
| **WebRTC** | Peer-to-peer (data + media) | UDP via ICE/STUN/TURN | Application-level | Out-of-band signaling | Audio/video calls, low-latency data |
| Long polling | Server → client (simulated) | HTTP | Easy | Standard HTTP | Legacy fallback |

## Server-Sent Events

The simplest real-time primitive. The server holds a Hypertext Transfer Protocol connection open and writes `text/event-stream` frames whenever new data is available; the browser's `EventSource` parses the stream and dispatches events to JavaScript.

### Client

```ts
const es = new EventSource("/events", { withCredentials: true });

es.onmessage = (e) => console.log("default channel:", e.data);
es.addEventListener("task-updated", (e) => {
  const task = JSON.parse(e.data);
  // ...
});

es.onerror = () => {
  // browser auto-reconnects; nothing to do unless es.readyState === CLOSED
};
```

### Server (Node)

```ts
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown, id?: string) => {
    if (id) res.write(`id: ${id}\n`);
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const interval = setInterval(() => send("ping", { ts: Date.now() }), 15_000);

  req.on("close", () => clearInterval(interval));
});
```

### Why SSE wins for "server tells client"

The browser implements automatic reconnection out of the box; on disconnect it retries with backoff and replays the `Last-Event-ID` header so the server can resume the stream from the last delivered event. The protocol is plain Hypertext Transfer Protocol, which means it works through corporate proxies, Content Delivery Networks, and authentication middleware unchanged. Cookies and custom headers are sent normally (WebSocket has caveats around credentialled cross-origin upgrades). And scaling is straightforward: load balancers and reverse proxies handle Server-Sent Events as ordinary long-lived Hypertext Transfer Protocol connections.

The cost is that the protocol is one-directional. If the client also needs to send messages, pair Server-Sent Events with a regular `POST` endpoint or use a separate WebSocket connection.

## WebSocket

The bidirectional answer. After a Hypertext Transfer Protocol `Upgrade` handshake, the connection becomes a duplex byte stream over which both peers can send framed messages at will.

### Client

```ts
const ws = new WebSocket("wss://api.example.com/ws");

ws.onopen = () => ws.send(JSON.stringify({ type: "hello" }));
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // ...
};
ws.onclose = (e) => {
  // implement reconnection with exponential backoff
};
```

### Server (using `ws` in Node)

```ts
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    // route, fan out, etc.
  });

  ws.on("close", () => {/* cleanup subscriptions */});

  setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "heartbeat" }));
  }, 30_000);
});
```

### Reconnection strategy

WebSocket does not auto-reconnect. The pattern senior candidates typically describe is exponential backoff with jitter, plus a resume-token mechanism similar to Server-Sent Events' `Last-Event-ID` if the server is willing to track per-client state.

```ts
let attempt = 0;
function connect() {
  const ws = new WebSocket(url);
  ws.onopen = () => { attempt = 0; };
  ws.onclose = () => {
    const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
    attempt++;
    setTimeout(connect, delay);
  };
}
```

### Auth

Three approaches are common. The first sends an authentication token in the `Sec-WebSocket-Protocol` subprotocol header during the upgrade; this is awkward because the header is semantically intended for protocol negotiation, but it works and survives the constraints of the browser's WebSocket Application Programming Interface, which does not allow custom headers. The second authenticates via cookie before the upgrade: the cookie is set by the normal login flow and the upgrade request includes it automatically because cookies are attached to same-origin requests by default. The third sends the token as the first WebSocket message after the connection opens; the server closes the connection if it does not receive a valid token within a short window.

Most production setups use the cookie approach because it is the simplest and reuses the existing session model without inventing a parallel authentication path.

### When to reach for libraries

For non-trivial WebSocket applications, a library handles the operational details. Socket.IO is the canonical abstraction over WebSocket, with rooms, namespaces, and an automatic fallback to long polling for hostile networks; it is excellent for chat-style applications. The `ws` package is a minimal server-side library, paired with a hand-rolled client when full control is desired. Pusher, Ably, and PubNub are managed services that remove the operational burden of running the WebSocket layer at scale. PartyKit and Cloudflare Durable Objects offer managed real-time on the edge with locality and per-connection state.

## WebRTC

Web Real-Time Communication is the right answer for low-latency peer-to-peer media (audio, video) and arbitrary data channels. The signaling — establishing the connection by exchanging session descriptions and Interactive Connectivity Establishment candidates — happens through the application's server (typically over WebSocket or `fetch`); the actual data then flows directly between peers via the User Datagram Protocol, with Network Address Translation traversal handled by Session Traversal Utilities for NAT and Traversal Using Relays around NAT servers.

```ts
const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

const dataChannel = pc.createDataChannel("game");
dataChannel.onmessage = (e) => console.log("got:", e.data);

const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
// Send `offer` to the peer via your signaling channel
// Peer creates answer, you setRemoteDescription(answer)
```

### Why it's complex

Three sources of complexity dominate. First, signaling is the application's problem; the specification deliberately does not define how peers exchange session descriptions, leaving it to each application to use WebSocket, `fetch`, or any other channel. Second, Network Address Translation traversal requires Session Traversal Utilities for NAT servers (which are free and lightweight) and often Traversal Using Relays around NAT servers (which relay traffic when peer-to-peer fails because of restrictive Network Address Translation, and which are bandwidth-expensive to run). Third, encoding and decoding for media are delegated to the browser, but track management — adding, removing, and renegotiating tracks during a call — is fiddly and a common source of edge-case bugs.

For applications that need video calls, use a managed solution such as LiveKit, Daily, Twilio Video, or Agora before considering raw Web Real-Time Communication. The savings in engineering time are substantial.

## Long polling

A legacy approach worth knowing for environments where the application sits behind a proxy that strips Hypertext Transfer Protocol upgrade headers, or for hostile networks where WebSocket connections are unreliable.

```ts
async function poll() {
  while (true) {
    const res = await fetch("/poll", { method: "GET" });
    const updates = await res.json();
    handle(updates);
  }
}
```

The server holds the request open until data is available (or a timeout, typically thirty seconds) and then returns. The client immediately re-requests. The pattern is slower per message and incurs more Hypertext Transfer Protocol overhead than dedicated real-time protocols, but it works through any Hypertext Transfer Protocol-friendly intermediary, which is the use case it justifies.

## When to choose which

| Need | Choose |
| --- | --- |
| Notifications, live activity feed, AI streaming | **SSE** |
| Chat, multi-user editing, live cursors, presence | **WebSocket** |
| Audio / video / low-latency game data | **WebRTC** |
| Hostile network compatibility | **Long polling** as fallback |
| Mobile app keep-alive on background | **Push notifications** (FCM/APNS) — neither WS nor SSE survives |

## Scaling notes

WebSocket scaling requires sticky sessions or a publish/subscribe backplane (Redis, NATS) so that messages produced on one server reach clients connected to a different server. Server-Sent Events has the same constraint. WebRTC scaling for many participants uses a Selective Forwarding Unit, where clients send their streams to a central server that re-broadcasts to other participants, instead of a full peer-to-peer mesh that would require N×N connections. Connection limits matter: a single Node.js process can hold approximately ten thousand concurrent connections before file descriptor limits and event-loop pressure become problematic. For more, scale horizontally with a backplane.

## Key takeaways

The senior framing: Server-Sent Events for server-to-client, WebSocket for bidirectional, Web Real-Time Communication for peer-to-peer media. Server-Sent Events auto-reconnects with `Last-Event-ID`; WebSocket requires the application to implement backoff and resume tokens. WebSocket authentication is best handled via the cookie set during normal login, or with a first-message handshake when cookies are unavailable. For large Web Real-Time Communication applications, use a managed service or a Selective Forwarding Unit; do not build the full mesh raw. Scale WebSocket and Server-Sent Events horizontally with sticky sessions plus a publish/subscribe backplane.

## Common interview questions

1. Server-Sent Events versus WebSocket — when each?
2. How does a Server-Sent Events client reconnect? What is `Last-Event-ID`?
3. Walk through a WebSocket reconnection strategy.
4. Why is Web Real-Time Communication hard? What is the signaling problem?
5. How can WebSocket connections be scaled horizontally?

## Answers

### 1. Server-Sent Events versus WebSocket — when each?

Server-Sent Events is the right choice for unidirectional server-to-client streams: notifications, live activity feeds, log tails, and Artificial Intelligence streaming responses. The protocol is plain Hypertext Transfer Protocol, the browser implements automatic reconnection with `Last-Event-ID`, cookies and custom headers work normally, and proxies/Content Delivery Networks/middleware handle it as ordinary long-lived requests. WebSocket is the right choice for bidirectional or low-latency two-way communication: chat, multi-user editing, presence indicators, live cursors, and game state synchronisation. WebSocket adds operational complexity (no auto-reconnect, awkward authentication, special handling in proxies) but is the only browser-native option for full-duplex.

**Trade-offs / when this fails.** Server-Sent Events is one-directional; pair it with a `POST` endpoint or a separate WebSocket if the client also needs to send. WebSocket connections are heavier on the server (one socket per client at all times) and harder to scale than Server-Sent Events because reconnection logic must be implemented and tested. For applications that are mostly server-to-client with occasional client-to-server actions, Server-Sent Events plus `POST` is operationally simpler than a single WebSocket.

### 2. How does an SSE client reconnect? What is `Last-Event-ID`?

The browser's `EventSource` automatically reconnects when the connection drops. The reconnection delay is controlled by the server through the `retry:` field in the event stream (in milliseconds), and defaults to a few seconds in the browser. On reconnect, the browser sends the `Last-Event-ID` header containing the value of the `id:` field of the most recently received event; the server uses this header to resume the stream from immediately after that event, ensuring no events are lost during the disconnect window.

```ts
const es = new EventSource("/events");
es.onmessage = (e) => console.log(e.lastEventId, e.data);
```

```ts
res.write(`id: 42\nevent: task-updated\ndata: ${JSON.stringify(task)}\n\n`);
```

**Trade-offs / when this fails.** The server must persist enough state (or use a durable event log) to honour `Last-Event-ID` resumption; if the server only buffers in memory and restarts, events sent during the gap are lost. Some Content Delivery Networks and proxies buffer responses and break the streaming guarantee; test the deployment topology end-to-end before assuming it works.

### 3. Walk through a WebSocket reconnection strategy.

The client implements exponential backoff with jitter on the `onclose` handler. On the first reconnection attempt, wait one second; on the second, two seconds; on the third, four seconds; cap at thirty seconds; and add up to a half-second of random jitter to avoid thundering-herd reconnects when the server restarts and many clients reconnect simultaneously. Reset the attempt counter to zero when the connection successfully opens. If the server tracks per-client state (subscriptions, room memberships, message offsets), the client sends a resume token in the first message after reconnect so the server can restore the state without the application having to re-subscribe to everything.

```ts
let attempt = 0;
function connect() {
  const ws = new WebSocket(url);
  ws.onopen = () => { attempt = 0; ws.send(JSON.stringify({ type: "resume", token: lastResumeToken })); };
  ws.onclose = () => {
    const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
    attempt++;
    setTimeout(connect, delay);
  };
}
connect();
```

**Trade-offs / when this fails.** The pattern requires the application to enqueue or drop messages produced while disconnected — there is no transport-level guarantee. Heartbeats (a periodic ping/pong) are necessary because some intermediaries silently drop idle connections and the application would otherwise not notice for minutes. Reconnection storms after a server restart can overload the new server; the jitter is essential, not optional.

### 4. Why is WebRTC hard? What is the signaling problem?

Web Real-Time Communication is a peer-to-peer media protocol designed to bypass the server for the actual data flow, which means the protocol has to solve every networking problem that the Hypertext Transfer Protocol's reliance on a server normally hides. The signaling problem is that two peers must exchange session descriptions (which codecs to use, which media tracks, which Interactive Connectivity Establishment candidate addresses) before they can connect, but they have no way to talk to each other yet — they need a server to relay the signaling. The specification deliberately does not define how this signaling happens, so every application invents its own (typically over WebSocket).

Beyond signaling, Network Address Translation traversal requires Session Traversal Utilities for NAT servers to discover the public address of each peer, and Traversal Using Relays around NAT servers to relay traffic when peer-to-peer fails because of restrictive Network Address Translation. Track management during a call is fiddly. Multi-party calls require a Selective Forwarding Unit because full mesh does not scale beyond a handful of participants.

**Trade-offs / when this fails.** Use a managed service (LiveKit, Daily, Twilio Video, Agora) for any application that needs video calls; the savings in engineering time are substantial. Raw Web Real-Time Communication is appropriate only for narrow use cases (custom data channels, deep customisation of the media pipeline) that justify the operational burden.

### 5. How can WebSocket connections be scaled horizontally?

The challenge is that WebSocket connections are stateful and long-lived; a message produced on one server must reach clients connected to other servers. The standard pattern is sticky sessions plus a publish/subscribe backplane. Sticky sessions ensure each client lands on a known server (typically by hashing the client's identifier in the load balancer); the publish/subscribe backplane (Redis Pub/Sub, NATS, AWS Simple Notification Service to Lambda fan-out) propagates messages between servers so every relevant client receives them.

Connection limits per server matter: a single Node.js process can hold approximately ten thousand concurrent connections before file descriptor limits and event-loop pressure dominate. Scale horizontally by adding more servers behind the load balancer, each subscribed to the backplane and each holding a fraction of the connections.

**Trade-offs / when this fails.** Sticky sessions reduce the load balancer's flexibility and complicate rolling deployments because connections must drain gracefully when a server is removed. The publish/subscribe backplane becomes a single point of failure and a bottleneck under high message rates; for very large deployments, partition the backplane by tenant or topic. Managed services such as Pusher, Ably, and PartyKit handle all of this for you and are usually cheaper than running it in-house unless the connection count is enormous.

## Further reading

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).
- [MDN: WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API).
- [WebRTC for the curious](https://webrtcforthecurious.com/) — free book.
- [Building large-scale WebSocket systems](https://ably.com/topic/scaling-pub-sub-with-websockets-and-redis).
