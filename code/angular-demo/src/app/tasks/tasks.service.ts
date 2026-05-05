import { Injectable, computed, signal } from "@angular/core";

export type Task = { id: string; title: string; done: boolean };

@Injectable({ providedIn: "root" })
export class TasksService {
  private readonly _tasks = signal<Task[]>([
    { id: "1", title: "Read the book", done: true },
    { id: "2", title: "Build the demo", done: false },
    { id: "3", title: "Pass the interview", done: false },
  ]);

  readonly tasks = this._tasks.asReadonly();
  readonly remaining = computed(() => this._tasks().filter((t) => !t.done).length);

  add(title: string) {
    if (!title.trim()) return;
    this._tasks.update((cur) => [
      ...cur,
      { id: crypto.randomUUID(), title: title.trim(), done: false },
    ]);
  }

  toggle(id: string) {
    this._tasks.update((cur) =>
      cur.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  remove(id: string) {
    this._tasks.update((cur) => cur.filter((t) => t.id !== id));
  }
}
