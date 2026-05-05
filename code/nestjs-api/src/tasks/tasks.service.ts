import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  CreateTaskDto,
  ListTasksQueryDto,
  UpdateTaskDto,
  type TaskStatus,
} from "./tasks.dto";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TasksService {
  private store: Task[] = [];

  list({ status, page, pageSize }: ListTasksQueryDto) {
    const all = this.store.filter((t) => !status || t.status === status);
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }

  get(id: string): Task {
    const t = this.store.find((x) => x.id === id);
    if (!t) throw new NotFoundException("Task not found");
    return t;
  }

  create(dto: CreateTaskDto): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description,
      status: dto.status ?? "open",
      createdAt: now,
      updatedAt: now,
    };
    this.store.push(task);
    return task;
  }

  update(id: string, dto: UpdateTaskDto): Task {
    const t = this.get(id);
    Object.assign(t, dto, { updatedAt: new Date().toISOString() });
    return t;
  }

  delete(id: string): void {
    const i = this.store.findIndex((t) => t.id === id);
    if (i < 0) throw new NotFoundException("Task not found");
    this.store.splice(i, 1);
  }
}
