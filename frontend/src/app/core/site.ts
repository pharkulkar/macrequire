import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/** Public origin of the site. The SSR server provides the runtime SITE_URL value; the browser uses the build value. */
export const SITE_URL = new InjectionToken<string>('SITE_URL', { providedIn: 'root', factory: () => environment.siteUrl });

/** Date used for legal pages and guides. Update when their content changes. */
export const CONTENT_DATES = {
  privacy: '2026-11-13',
  terms: '2026-11-13',
  guides: '2026-11-13',
} as const;

export const prettyDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
