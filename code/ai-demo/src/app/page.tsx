"use client";

import { useChat } from "@ai-sdk/react";

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, status, stop } = useChat({
    api: "/api/chat",
  });

  return (
    <main>
      <h1>Streaming chat</h1>
      <p>Set <code>OPENAI_API_KEY</code> in <code>.env.local</code> to use the OpenAI provider.</p>

      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {messages.map((m) => (
          <li
            key={m.id}
            style={{
              padding: "0.5rem",
              marginBlockEnd: "0.25rem",
              borderRadius: 6,
              background: m.role === "user" ? "#eef" : "#efe",
            }}
          >
            <strong>{m.role}:</strong> {m.content}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask something..."
          style={{ flex: 1, padding: "0.5rem" }}
        />
        {status === "streaming" ? (
          <button type="button" onClick={stop}>Stop</button>
        ) : (
          <button type="submit">Send</button>
        )}
      </form>
    </main>
  );
}
