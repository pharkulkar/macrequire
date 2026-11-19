import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Footer } from './layout/footer/footer';
import { Header } from './layout/header/header';
import { TestSession } from './core/test-session';
import { CompareTray } from './shared/compare-tray/compare-tray';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, CompareTray],
  template: `
    @if (isAdmin()) {
      <!-- The test-mode notice is for administrators only; visitors' pages never show it, even while test mode is on. -->
      @if (test.active()) {
        <div class="test-banner" role="status">
          <strong>Test mode is on.</strong> Recommendations and Buy clicks from this browser are saved as test data and kept out of your analytics.
          <button type="button" (click)="test.stop()">Stop test mode</button>
        </div>
      }
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
    .test-banner { position: sticky; top: 0; z-index: 50; background: #fff4d6; color: #5c3b00; border-bottom: 1px solid #f0c98f; padding: 0.5rem 1rem; font-size: 0.88rem; text-align: center; }
    .test-banner button { margin-left: 0.75rem; font: inherit; font-size: 0.82rem; border: 1px solid #c9a24a; border-radius: 999px; background: #fff; padding: 0.15rem 0.7rem; cursor: pointer; }
  `,
})
export class App {
  protected readonly test = inject(TestSession);
  private readonly router = inject(Router);
  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => (e as NavigationEnd).urlAfterRedirects)), { initialValue: this.router.url });
  /** The admin area has its own layout, so the public header, footer and comparison tray are hidden there. */
  protected readonly isAdmin = computed(() => this.url().startsWith('/admin'));
}
