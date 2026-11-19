import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Footer } from './layout/footer/footer';
import { Header } from './layout/header/header';
import { CompareTray } from './shared/compare-tray/compare-tray';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, CompareTray],
  template: `
    @if (isAdmin()) {
      <router-outlet />
    } @else {
      <a class="sr-only" href="#main">Skip to content</a>
      <app-header />
      <main id="main" tabindex="-1"><router-outlet /></main>
      <app-footer />
      <app-compare-tray />
    }
  `,
  styles: `
    main { min-height: 70vh; outline: none; }
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => (e as NavigationEnd).urlAfterRedirects)), { initialValue: this.router.url });
  /** The admin area has its own layout, so the public header, footer and comparison tray are hidden there. */
  protected readonly isAdmin = computed(() => this.url().startsWith('/admin'));
}
