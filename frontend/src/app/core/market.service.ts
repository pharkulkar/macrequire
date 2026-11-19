import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export type MarketCode = 'US' | 'IN';
export interface MarketInfo { country: MarketCode; currency: 'USD' | 'INR'; name: string }
interface MarketResponse { detected: string | null; basis: 'network' | 'language' | 'none'; market: MarketCode; fallback: boolean; default: MarketCode; available: MarketInfo[] }

export const DEFAULT_MARKET: MarketCode = 'US';
const STORAGE_KEY = 'macrequire.market';

/**
 * Which country's offers and prices the visitor sees.
 *
 * Pages rendered on the server (and seen by search engines) always use the default market, so the HTML is the same
 * for everyone and can be cached. In the browser, after the page has loaded, the visitor's market is looked up:
 * their saved choice first, otherwise the country the server detected, otherwise the default. Pages that depend on
 * the market reload when it changes. Nothing about the visitor is stored on our servers; the choice stays in the
 * browser's local storage.
 */
@Injectable({ providedIn: 'root' })
export class Market {
  private readonly api = inject(ApiService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly country = signal<MarketCode>(DEFAULT_MARKET);
  readonly available = signal<MarketInfo[]>([]);
  /** True once the browser has finished looking up the market (always true on the server). */
  readonly resolved = signal(!this.browser);
  /** The visitor's own country has no data, so another market is shown. */
  readonly fallbackFrom = signal<string | null>(null);
  readonly current = computed(() => this.available().find((m) => m.country === this.country()) ?? null);
  readonly currency = computed(() => this.current()?.currency ?? (this.country() === 'IN' ? 'INR' : 'USD'));

  constructor() {
    if (!this.browser) return;
    // Wait until the page has been hydrated, so the first browser render matches the server-rendered HTML.
    afterNextRender(() => this.init());
  }

  private init() {
    this.api.get<MarketResponse>('/market').subscribe({
      next: (r) => {
        this.available.set(r.available);
        const saved = this.saved();
        const chosen = saved && r.available.some((m) => m.country === saved) ? saved : r.market;
        this.fallbackFrom.set(!saved && r.fallback && r.detected && r.detected !== r.default ? r.detected : null);
        this.country.set(chosen);
        this.resolved.set(true);
      },
      error: () => this.resolved.set(true), // keep the default market if the lookup fails
    });
  }

  /** The visitor picked a market in the header. */
  select(country: MarketCode) {
    if (!this.available().some((m) => m.country === country)) return;
    this.country.set(country);
    this.fallbackFrom.set(null);
    try {
      localStorage.setItem(STORAGE_KEY, country);
    } catch {
      /* private mode: the choice just lasts for this visit */
    }
  }

  private saved(): MarketCode | null {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'US' || v === 'IN' ? v : null;
    } catch {
      return null;
    }
  }
}
