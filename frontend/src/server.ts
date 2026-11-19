import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { environment } from './environments/environment';
import { GUIDES, STATIC_PAGES } from './app/core/guides';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
app.disable('x-powered-by');

const siteUrl = () => (process.env['SITE_URL'] ?? environment.siteUrl).replace(/\/$/, '');

// Angular rejects requests whose Host header is not on this list (protects against host-header attacks).
// The public site's own host is always allowed; add more (comma separated) with ALLOWED_HOSTS.
const allowedHosts = [
  'localhost',
  (() => {
    try {
      return new URL(siteUrl()).hostname;
    } catch {
      return 'localhost';
    }
  })(),
  ...(process.env['ALLOWED_HOSTS'] ?? '').split(',').map((h) => h.trim()).filter(Boolean),
];
const angularApp = new AngularNodeAppEngine({ allowedHosts });
const apiUrl = () => (process.env['API_URL'] ?? environment.apiUrl).replace(/\/$/, '');
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ------------------------------------------------------------------ security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// ---------------------------------------------------------------------- robots.txt
/** Private areas stay out of search. Public pages, including for AI search and answer crawlers, are open. */
const DISALLOW = ['/admin', '/results', '/compare', '/offer-unavailable', '/find'];
const AI_SEARCH_AGENTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User'];
const AI_TRAINING_AGENTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended'];

app.get('/robots.txt', (_req, res) => {
  const blockTraining = process.env['BLOCK_AI_TRAINING'] === 'true';
  const rules = (allow: boolean) => (allow ? ['Allow: /', ...DISALLOW.map((p) => `Disallow: ${p}`)] : ['Disallow: /']);
  const group = (agents: string[], allow: boolean) => [...agents.map((a) => `User-agent: ${a}`), ...rules(allow), ''].join('\n');
  const body = [
    group(['*'], true),
    '# AI search and answer engines are welcome so MacRequire can be cited accurately.',
    group(AI_SEARCH_AGENTS, true),
    `# AI model-training crawlers: ${blockTraining ? 'blocked (BLOCK_AI_TRAINING=true)' : 'allowed (set BLOCK_AI_TRAINING=true to block)'}.`,
    group(AI_TRAINING_AGENTS, !blockTraining),
    `Sitemap: ${siteUrl()}/sitemap.xml`,
    '',
  ].join('\n');
  res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(body);
});

// --------------------------------------------------------------------- sitemap.xml
interface ProductRef { slug: string; verifiedAt: string | null }
let sitemapCache: { at: number; body: string } | null = null;

async function fetchProducts(): Promise<ProductRef[]> {
  const r = await fetch(`${apiUrl()}/products?pageSize=100`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`products ${r.status}`);
  return ((await r.json()) as { data: ProductRef[] }).data;
}

app.get('/sitemap.xml', async (_req, res) => {
  if (sitemapCache && Date.now() - sitemapCache.at < 600_000) return void res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(sitemapCache.body);
  let products: ProductRef[] = [];
  try {
    products = await fetchProducts();
  } catch (err) {
    // Serve the static pages rather than failing; crawlers retry later.
    console.error('sitemap: could not load products', err instanceof Error ? err.message : err);
  }
  const url = (loc: string, lastmod?: string | null) => `  <url><loc>${xml(siteUrl() + loc)}</loc>${lastmod ? `<lastmod>${xml(lastmod.slice(0, 10))}</lastmod>` : ''}</url>`;
  const body = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...STATIC_PAGES.map((p) => url(p.path === '/' ? '/' : p.path, p.lastmod)), ...products.map((p) => url(`/catalog/${p.slug}`, p.verifiedAt)), '</urlset>', ''].join('\n');
  if (products.length) sitemapCache = { at: Date.now(), body };
  res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(body);
});

// ----------------------------------------------------------------------- llms.txt
/** A plain-language map of the site for AI assistants. A convention, not a standard that every engine reads. */
app.get('/llms.txt', (_req, res) => {
  const s = siteUrl();
  const link = (p: { path: string; title: string; description: string }) => `- [${p.title}](${s}${p.path}): ${p.description}`;
  const body = [
    `# ${environment.siteName}`,
    '',
    '> MacRequire recommends the exact MacBook configuration (chip, memory and storage) that fits a person’s applications, workload, budget and future needs. Every current MacBook configuration is scored separately. Scores are our own estimates, not benchmarks; specifications come from Apple and prices from merchants.',
    '',
    '## How recommendations work',
    link(STATIC_PAGES.find((p) => p.path === '/methodology')!),
    link(STATIC_PAGES.find((p) => p.path === '/affiliate-disclosure')!),
    '',
    '## Guides',
    ...GUIDES.map((g) => `- [${g.title}](${s}/guides/${g.slug}): ${g.summary}`),
    '',
    '## Data',
    link(STATIC_PAGES.find((p) => p.path === '/catalog')!),
    link(STATIC_PAGES.find((p) => p.path === '/applications')!),
    '',
    '## Optional',
    link(STATIC_PAGES.find((p) => p.path === '/about')!),
    link(STATIC_PAGES.find((p) => p.path === '/privacy')!),
    link(STATIC_PAGES.find((p) => p.path === '/terms')!),
    '',
  ].join('\n');
  res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(body);
});

// ------------------------------------------------------------------ static assets
// Fingerprinted build files never change, so they are cached for a year. Everything else (images, icons) for a day.
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', /-[A-Za-z0-9_]{8,}\.(js|css|woff2?)$/.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');
    },
  }),
);

// ------------------------------------------------------------ content security policy
/**
 * Limits what a page may load or run, so an injected script could not run or send data elsewhere (defence in depth;
 * Angular already escapes everything). Server-rendered HTML contains a few small scripts written by Angular, and the
 * responses are cached, so a per-request nonce would not work. Instead each inline script is allowed by its hash,
 * computed from the very HTML being sent. JSON data blocks (structured data, Angular's state) are not executed and need no entry.
 */
const apiOrigin = () => {
  try {
    return new URL(process.env['PUBLIC_API_URL'] ?? environment.apiUrl).origin;
  } catch {
    return '';
  }
};
function contentSecurityPolicy(html: string): string {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/\bsrc\s*=/i.test(attrs) && !/\btype\s*=\s*["']application\/(ld\+)?json["']/i.test(attrs))
    .map(([, , body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  const extraConnect = (process.env['CSP_CONNECT_SRC'] ?? '').split(/[\s,]+/).filter(Boolean);
  return [
    "default-src 'self'",
    `script-src 'self' ${[...new Set(hashes)].join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'", // Angular adds component styles as inline <style> elements
    "img-src 'self' data: https:", // product photos can come from any https address an administrator sets
    "font-src 'self' data:",
    `connect-src 'self' ${[apiOrigin(), ...extraConnect].filter(Boolean).join(' ')}`.trim(),
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

// ---------------------------------------------------------------------- the app
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then(async (response) => {
      if (!response) return next();
      if ((response.headers.get('content-type') ?? '').includes('text/html')) {
        const html = await response.text();
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy', contentSecurityPolicy(html));
        headers.delete('content-length');
        response = new Response(html, { status: response.status, statusText: response.statusText, headers });
      }
      return writeResponseToNodeResponse(response, res);
    })
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4200;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`MacRequire web server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
