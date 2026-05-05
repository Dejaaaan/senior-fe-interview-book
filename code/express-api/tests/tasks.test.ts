import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "../src/server.js";

describe("Tasks API (express)", () => {
  it("creates and lists a task", async () => {
    const app = buildApp();
    const created = await request(app).post("/tasks").send({ title: "Write the chapter" }).expect(201);
    expect(created.body).toMatchObject({ title: "Write the chapter", status: "open" });

    const listed = await request(app).get("/tasks").expect(200);
    expect(listed.body.items.some((t: { id: string }) => t.id === created.body.id)).toBe(true);
  });

  it("400s on invalid body", async () => {
    const app = buildApp();
    await request(app).post("/tasks").send({}).expect(400);
  });
});
