import { TasksService } from "./tasks.service";

describe("TasksService", () => {
  it("starts with three tasks and one done", () => {
    const svc = new TasksService();
    expect(svc.tasks().length).toBe(3);
    expect(svc.remaining()).toBe(2);
  });

  it("adds, toggles, removes", () => {
    const svc = new TasksService();
    svc.add("New task");
    expect(svc.tasks().length).toBe(4);

    const newTask = svc.tasks().find((t) => t.title === "New task")!;
    expect(newTask.done).toBeFalse();

    svc.toggle(newTask.id);
    expect(svc.tasks().find((t) => t.id === newTask.id)!.done).toBeTrue();

    svc.remove(newTask.id);
    expect(svc.tasks().some((t) => t.id === newTask.id)).toBeFalse();
  });
});
