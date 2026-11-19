import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Market, MarketCode } from '../../core/market.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="container header__inner">
        <a routerLink="/" class="brand" aria-label="MacRequire home">Mac<span>Require</span></a>

        <button
          class="menu-btn"
          type="button"
          [attr.aria-expanded]="open()"
          aria-controls="primary-nav"
          (click)="open.set(!open())"
        >
          <span class="sr-only">Toggle navigation</span>
          <span aria-hidden="true">{{ open() ? '✕' : '☰' }}</span>
        </button>

        <nav id="primary-nav" class="nav" [class.nav--open]="open()" aria-label="Primary">
          <a routerLink="/catalog" routerLinkActive="active" (click)="open.set(false)">MacBooks</a>
          <a routerLink="/applications" routerLinkActive="active" (click)="open.set(false)">Applications</a>
          <a routerLink="/compare" routerLinkActive="active" (click)="open.set(false)">Compare</a>
          <a routerLink="/about" routerLinkActive="active" (click)="open.set(false)">About</a>
          @if (market.available().length > 1) {
            <label class="market">
              <span class="sr-only">Shop in</span>
              <select (change)="pick($any($event.target).value)" aria-label="Country for prices and stores">
                @for (m of market.available(); track m.country) { <option [value]="m.country" [selected]="m.country === market.country()">{{ m.name }} ({{ m.currency }})</option> }
              </select>
            </label>
          }
          <a routerLink="/find" class="btn btn--primary nav__cta" (click)="open.set(false)">Find My MacBook</a>
        </nav>
      </div>
      <!-- Hidden for now: the "we don't have <country> prices yet" notice. Re-enable once country detection uses host/CDN headers.
      @if (notice(); as n) {
        <p class="market-note" role="status">
          We don't have {{ n }} prices yet, so you're seeing {{ market.current()?.name ?? 'United States' }} prices and stores.
          <button type="button" class="market-note__close" (click)="dismissed.set(true)" aria-label="Dismiss">✕</button>
        </p>
      }
      -->

    </header>
  `,
  styleUrl: './header.scss',
})
export class Header {
  protected readonly market = inject(Market);
  protected readonly open = signal(false);
  protected readonly dismissed = signal(false);
  /** Name of the visitor's country when we have no data for it. */
  protected readonly notice = computed(() => {
    const code = this.market.fallbackFrom();
    if (!code || this.dismissed()) return null;
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  });
  protected pick(value: string) {
    this.market.select(value as MarketCode);
  }
}
