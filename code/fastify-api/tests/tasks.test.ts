import { describe, it, expect } from "vitest";
import { buildApp } from "../src/server.js";

describe("Tasks API (fastify)", () => {
  it("creates a task", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/tasks",
      payload: { title: "Write the chapter" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ title: "Write the chapter" });
    await app.close();
  });

  it("400s on invalid body", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/tasks", payload: {} });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
