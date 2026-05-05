import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./counter/counter.component").then((m) => m.CounterComponent),
  },
  {
    path: "tasks",
    loadComponent: () =>
      import("./tasks/tasks.component").then((m) => m.TasksComponent),
  },
  { path: "**", redirectTo: "" },
];
