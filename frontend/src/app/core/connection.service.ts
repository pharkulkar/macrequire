import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';

/** Whether the browser has a network connection, so the site can say "You're offline" instead of failing quietly. */
@Injectable({ providedIn: 'root' })
export class Connection {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly online = signal(true);
  /** Set when a page could not be opened (for example its code could not be downloaded), cleared on the next successful page. */
  readonly pageError = signal<string | null>(null);

  reportPageError() {
    this.pageError.set(this.online() ? "That page couldn't be opened. Please try again." : "That page couldn't be opened because you're offline. Check your connection and try again.");
  }

  constructor() {
    // Read after hydration, so the first browser render matches the server-rendered HTML.
    if (this.browser) {
      afterNextRender(() => {
        this.online.set(navigator.onLine);
        window.addEventListener('online', () => this.online.set(true));
        window.addEventListener('offline', () => this.online.set(false));
      });
    }
  }
}
