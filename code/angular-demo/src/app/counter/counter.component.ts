import { Component, computed, signal } from "@angular/core";

@Component({
  selector: "app-counter",
  standalone: true,
  template: `
    <h2>Counter</h2>
    <button (click)="dec()">−</button>
    <span style="margin: 0 0.5rem;">{{ count() }}</span>
    <button (click)="inc()">+</button>
    <p>Doubled: {{ doubled() }}</p>
  `,
})
export class CounterComponent {
  count = signal(0);
  doubled = computed(() => this.count() * 2);

  inc() { this.count.update((n) => n + 1); }
  dec() { this.count.update((n) => n - 1); }
}
