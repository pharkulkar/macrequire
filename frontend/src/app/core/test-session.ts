import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';

const KEY = 'macrequire.testSession';

interface Stored { token: string; expiresAt: string }

/** The test-session token, or null when there is none, it has expired, or the code runs on the server. */
export function readTestToken(): string | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s?.token || new Date(s.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s.token;
  } catch {
    return null;
  }
}

/** The expiry (from the token's own `exp` claim), used when a token arrives in a link. */
function expiryOf(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    if (payload.exp) return new Date(payload.exp * 1000).toISOString();
  } catch {
    /* fall through */
  }
  return new Date(Date.now() + 12 * 3_600_000).toISOString();
}

/**
 * Test mode for administrators. While it is on, this browser sends a signed token with its requests, and the server
 * tags the recommendations and outbound clicks it records as test data (kept out of the analytics, removable in the
 * admin). Without a valid token nothing can be tagged, so visitors cannot hide real activity.
 *
 * A link such as /?testSession=<token> switches test mode on in another browser or on a phone.
 */
@Injectable({ providedIn: 'root' })
export class TestSession {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly active = signal(false);
  readonly expiresAt = signal<string | null>(null);

  constructor() {
    // Read after the page has been hydrated, so the first browser render matches the server-rendered HTML.
    if (this.browser) afterNextRender(() => this.init());
  }

  private init() {
    const url = new URL(window.location.href);
    const fromLink = url.searchParams.get('testSession');
    if (fromLink) {
      this.start(fromLink, expiryOf(fromLink));
      url.searchParams.delete('testSession');
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    } else {
      this.refresh();
    }
  }

  refresh() {
    const token = readTestToken();
    this.active.set(Boolean(token));
    try {
      this.expiresAt.set(token ? (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Stored).expiresAt : null);
    } catch {
      this.expiresAt.set(null);
    }
  }

  start(token: string, expiresAt: string) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ token, expiresAt } satisfies Stored));
    } catch {
      /* private mode: test mode cannot be kept */
    }
    this.refresh();
  }

  stop() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to remove */
    }
    this.refresh();
  }

  /** A link that switches test mode on in another browser. */
  link(): string | null {
    const token = readTestToken();
    return token && this.browser ? `${window.location.origin}/?testSession=${encodeURIComponent(token)}` : null;
  }
}
