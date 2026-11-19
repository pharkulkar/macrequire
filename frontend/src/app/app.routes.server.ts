import { RenderMode, ServerRoute } from '@angular/ssr';

const PRIVATE_HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-cache' };

/**
 * Public content pages are rendered on the server on each request, so crawlers (including AI crawlers that do not
 * run JavaScript) receive complete HTML with fresh prices. Private, interactive pages are rendered in the browser
 * and marked noindex.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'admin', renderMode: RenderMode.Client, headers: PRIVATE_HEADERS },
  { path: 'admin/**', renderMode: RenderMode.Client, headers: PRIVATE_HEADERS },
  { path: 'find', renderMode: RenderMode.Client, headers: PRIVATE_HEADERS },
  { path: 'results', renderMode: RenderMode.Client, headers: PRIVATE_HEADERS },
  { path: 'results/:id', renderMode: RenderMode.Client, headers: PRIVATE_HEADERS },
  { path: 'compare', renderMode: RenderMode.Client, headers: PRIVATE_HEADERS },
  { path: 'offer-unavailable', renderMode: RenderMode.Client, headers: PRIVATE_HEADERS },
  { path: '**', renderMode: RenderMode.Server, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' } },
];
