import { Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <h1>Angular demo</h1>
    <nav>
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Counter</a>
      &middot;
      <a routerLink="/tasks" routerLinkActive="active">Tasks</a>
    </nav>
    <hr />
    <router-outlet />
  `,
})
export class AppComponent {}
