import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { describe, it, expect, beforeEach } from "vitest";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

describe("TasksController", () => {
  let controller: TasksController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [TasksService],
    }).compile();

    controller = module.get(TasksController);
  });

  it("creates and lists a task", () => {
    const created = controller.create({ title: "Write the chapter" });
    expect(created.title).toBe("Write the chapter");
    const listed = controller.list({ page: 1, pageSize: 10 });
    expect(listed.items.some((t) => t.id === created.id)).toBe(true);
  });
});
