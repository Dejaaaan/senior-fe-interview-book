import { Component, computed, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { TasksService } from "./tasks.service";

@Component({
  selector: "app-tasks",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <h2>Tasks ({{ tasks.remaining() }} remaining)</h2>

    <form [formGroup]="form" (ngSubmit)="add()">
      <input formControlName="title" placeholder="What needs doing?" />
      <button [disabled]="form.invalid">Add</button>
    </form>

    <input
      type="search"
      placeholder="filter…"
      [value]="filter()"
      (input)="setFilter($event)"
      style="margin-top: 1rem; width: 100%;"
    />

    <ul>
      @for (t of filtered(); track t.id) {
        <li [class.done]="t.done">
          <input type="checkbox" [checked]="t.done" (change)="tasks.toggle(t.id)" />
          {{ t.title }}
          <button (click)="tasks.remove(t.id)">remove</button>
        </li>
      } @empty {
        <li>No tasks match.</li>
      }
    </ul>
  `,
})
export class TasksComponent {
  protected readonly tasks = inject(TasksService);
  private readonly fb = inject(FormBuilder);

  filter = signal("");

  filtered = computed(() => {
    const q = this.filter().toLowerCase();
    return q
      ? this.tasks.tasks().filter((t) => t.title.toLowerCase().includes(q))
      : this.tasks.tasks();
  });

  form = this.fb.nonNullable.group({
    title: ["", [Validators.required, Validators.maxLength(120)]],
  });

  setFilter(event: Event) {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  add() {
    if (this.form.invalid) return;
    this.tasks.add(this.form.controls.title.value);
    this.form.reset();
  }
}
