# MacRequire

Configuration-level MacBook recommendation and affiliate platform.

```text
macrequire/
├── frontend/   Angular (standalone components, signals, SCSS)
├── backend/    Node.js + Express + TypeScript + Prisma + PostgreSQL
└── docker-compose.yml   optional local Postgres
```

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Foundation: scaffolds, Prisma schema, API skeleton, homepage, navigation | Done |
| 2 | Product catalog: migrations, verified seed, catalog APIs, catalog + detail pages | Done |
| 3 | Questionnaire + application database + application directory | Done |
| 4 | Recommendation engine + APIs (backend only) | Done |
| 5 | Results page, score breakdown, comparison, purchase buttons | Done |
| 6 | Affiliate system: offers, outbound redirect, click tracking, analytics API | Done |
| 7 | Admin dashboard: pricing, CSV import, catalog, applications, scoring rules with preview, analytics, team and audit | Done |
| 8 | SEO, AEO, GEO and legal pages (server-side rendering) | Done |

Pages for later phases are routed to a labelled placeholder.

## Prerequisites

- Node.js 20+ (developed on 24)
- PostgreSQL 14+ (or Docker for `docker-compose.yml`)

## Setup

```bash
# 1. Database (optional, if you have no local Postgres)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # then set JWT_SECRET and IP_HASH_SALT
npm install
npm run db:generate
npm run db:deploy             # applies the committed migrations
npm run db:seed               # catalog, merchants, admin user
npm run dev                   # http://localhost:4000/api/health

# 3. Frontend (new terminal)
cd frontend
npm install
npm start                     # http://localhost:4200
```

The API base URL for the frontend is in `frontend/src/environments/environment.ts`.

## Backend commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start API with reload |
| `npm run build` / `npm start` | Compile and run production build |
| `npm run typecheck` | Type-check without emitting |
| `npm run db:migrate` | Create/apply dev migrations |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed catalog, merchants and admin user (idempotent) |

## Architecture rules

- All scoring happens in the backend, in a module independent of Express controllers.
- Scoring weights and rules live in the database (`ScoringRuleSet`), not in code.
- Specifications, offers/prices, affiliate links and recommendation output are separate tables.
- Sample data is labelled `SAMPLE` via the `DataSource` enum. Specs must come from official sources.

## Catalog data: what is and is not verified

Seeded from Apple's official support pages on 2026-11-12 (`backend/prisma/data/catalog.ts` lists the exact URLs).

- 6 models, 4 chips, 94 configurations covering the Apple Silicon MacBooks currently on Apple's store.
- Each configuration has a `verification` level:
  - `STORE_CONFIRMED` (24): an Apple store page for that exact combination was observed.
  - `CTO_DERIVED` (70): follows from Apple's documented configure-to-order options for that chip variant. The exact combination was not individually confirmed, so the UI labels it and says to confirm at checkout.
- **No prices, offers or affiliate links are seeded.** Merchants exist, but nothing is purchasable until offers are added (admin, Phase 6-7).
- `cpuPerfIndex` / `gpuPerfIndex` on chips are a core-count proxy, not benchmarks (see `perfIndexBasis`). Replace them before relying on CPU/GPU scores.
- Not included: PROLED XDR MacBook Pro models (Oct 2026), the nano-texture option as its own record, and historical/Intel models. Add them through the CSV import (Phase 7).
- Storage is stored in GB with 1TB = 1024GB.

## API (Phase 2)

Base path `/api`. List endpoints return `{ data, pagination }`. Errors return `{ error: { message, details? } }`.

| Endpoint | Description |
|---|---|
| `GET /health` | API and database status |
| `GET /products` | Models. Query: `category`, `generation`, `q`, `page`, `pageSize` |
| `GET /products/:idOrSlug` | Model with all its configurations |
| `GET /products/:idOrSlug/configurations` | Configurations for a model |
| `GET /configurations` | Query: `category`, `modelId`, `chip`, `minRam`, `maxRam`, `minStorage`, `maxStorage`, `screenSize`, `sort` (`newest`/`ram`/`storage`), `page`, `pageSize` |
| `GET /configurations/compare?ids=a,b,c` | 2 to 4 configurations plus the strongest value per attribute |
| `GET /configurations/:id` | One configuration with specs, provenance and offers |
| `GET /merchants?country=IN` | Active merchants |
| `GET /offers/:configurationId?country=US` | Active offers (affiliate URLs are never exposed; use the outbound path) |

## Application data (Phase 3)

- 51 applications and 16 use cases are seeded (`backend/prisma/data/applications.ts`).
- Requirements carry a `basis`: `VENDOR_PUBLISHED` (RAM figures from the vendor's own page: Final Cut Pro and Docker Desktop only) or `ESTIMATE` (everything else). CPU/GPU demand, storage and concurrency are always MacRequire estimates. The UI shows which is which.
- 4 entries (Visual Studio, SolidWorks, Revit, Access) are marked not available on macOS so the engine can raise compatibility warnings.
- Use-case scoring multipliers are tunable defaults, not measurements.
- Seeding is create-only so admin edits survive. Run `SEED_RESET_APPLICATIONS=1 npm run db:seed` to overwrite applications and use cases with the seed values.

| Endpoint | Description |
|---|---|
| `GET /applications` | Query: `q`, `category`, `categories` (comma list), `macSupported`, `page`, `pageSize` |
| `GET /applications/search?q=&limit=` | Ranked search over names and aliases |
| `GET /applications/categories` | Categories with counts |
| `GET /applications/:idOrSlug` | One application with requirements and provenance |
| `GET /use-cases` | Use cases with category weights and suggested app categories |

The questionnaire answers are validated by `backend/src/modules/recommendation/profile.schema.ts` (the contract the engine will consume). In the browser the draft and finished profile are kept in `sessionStorage`.

## Recommendation engine (Phase 4)

The engine is a pure module in `backend/src/engine/` (no Express, no Prisma). `modules/recommendation/` loads data, calls `recommend()`, and stores the profile, results and per-category score breakdowns. Nothing about scoring lives in the frontend.

**How a recommendation is built**

1. **Combined workload** (`workload.ts`). Applications are not summed. Memory = OS overhead + the largest app in full + every other app scaled by its concurrency factor and the user's overlap level. Each app sits between its minimum and preferred RAM according to the user's intensity. CPU/GPU demand is dominated by the heaviest app. Storage footprints do add up. Three RAM figures result: *minimum* (to run), *target* (comfortable), *future* (adds future apps, "I may..." answers and growth over the ownership period).
2. **Per-configuration scores**, each 0-100: CPU, GPU, RAM, storage, application compatibility, budget, portability, battery, future-proofing, plus an optional display score that only activates if the user states a display-quality preference.
3. **Weights** come from the active `ScoringRuleSet` row, then are multiplied by the average of the chosen use cases' multipliers and by the user's preference importance (1-5). Categories that do not apply (for example compatibility when no apps are selected) are left out of the denominator. `finalScore = sum(score x weight) / sum(applicable weights)`.
4. **Penalties and constraints**: RAM below the workload minimum (x0.6) or below target (points off), storage far short of need (x0.85), and a small over-provisioning deduction for capacity well beyond projected need (never counting capacity below the smallest machine that exists). Over-budget configurations are excluded, out-of-stock ones are excluded, and slightly-over-budget ones can appear as "Worth stretching your budget?" only if they beat the best in-budget option by a margin.
5. **Missing data is never rewarded**: a missing value scores a conservative default (40) and is flagged `estimated`. When no verified price exists, the budget score uses that default and a `NO_PRICES` warning tells the user their budget could not be applied.
6. **Presentation**: top 5, one per hardware class. Other storage sizes (and larger-memory variants that score the same) are folded into `variants` on that result; each was still scored independently. Labels (`BEST_OVERALL`, `BEST_VALUE`, `BEST_PERFORMANCE`, `BEST_FUTURE`) are awarded only when a result wins its criterion by a margin among qualifying results, at most two per configuration. `STRETCH` results are returned separately with the extra cost.
7. **Explanations**: every result carries reasons, limitations, a future-proofing assessment, a summary sentence and its penalties. `comparisons` explains why each rank beats the next using weighted-contribution differences.

**Tuning.** All thresholds, curves and multipliers are in `src/engine/rules.ts` (`defaultRules`, `defaultWeights`) and are copied into the database by the seed. Stored values override code defaults, so admin edits survive. When the code defaults move to a new `version`, the seed prints a notice; run `SEED_RESET_APPLICATIONS=1 npm run db:seed` to adopt them (this overwrites edits). Every number is an estimate, not a measurement.

**Known limits**

- Without verified prices, ranking favours more capable machines (damped by the over-provisioning rule). Budget exclusion, value labels and stretch options only work once offers exist (Phase 6-7).
- CPU/GPU capability uses a core-count proxy, not benchmarks (see `perfIndexBasis` on chips).
- Battery uses Apple's claimed video-streaming hours.
- Application demands are mostly estimates (see Application data).

### Recommendation API

| Endpoint | Description |
|---|---|
| `POST /recommendations` | Body is the questionnaire profile (`profile.schema.ts`). Returns `201` with the stored recommendation: `id`, `workload`, `warnings`, `matches`, `stretch`, `comparisons`, `notice`. Rate limited to 20/minute per IP. |
| `GET /recommendations/:id` | The stored recommendation. |
| `GET /recommendations/:id/breakdown` | Per-category score, weight, contribution and the numbers behind each score, for every result. |
| `POST /recommendations/compare` | `{ recommendationId | profile, configurationIds: [2-4] }`. Scores those configurations for the profile, with a score matrix and pairwise explanations. Nothing is stored. |

## Results and comparison UI (Phase 5)

- `/find` posts the questionnaire to `POST /recommendations` and opens `/results/:id`. `/results` returns to the last recommendation of the tab. A stored recommendation can be reopened by id.
- The results page shows the workload we estimated, any warnings (for example that prices are missing), a highlights strip for the labels that were genuinely earned, five ranked cards, and a separate "Worth Stretching Your Budget?" section when something qualifies. Labels are never shown unless they were awarded by the engine.
- Each card shows the exact configuration, price (or "Price not verified yet"), a score ring, reasons, limitations, a future-proofing assessment, other sizes of the same hardware, and an expandable breakdown (score, weight, contribution and a one-line account per category).
- **Compare**: up to 4 configurations from a card or the catalog; the basket lives in `sessionStorage` and a floating tray shows it. `/compare` scores the chosen configurations against your recommendation (score, application compatibility, future-proofing, memory fit) plus specifications, highlights the strongest cell per row, and explains how they differ. Without a recommendation it compares specifications only.
- **Buy buttons** only appear when an active, in-stock offer exists for the user's country. They point to `/api/outbound/:offerId?source=...&result=...` (built in Phase 6) with `rel="sponsored"`. Until that endpoint exists, nothing is purchasable because no offers are seeded. Prices marked `SAMPLE` are labelled "Sample price (development data)".
- All scoring stays on the server. The frontend only formats and highlights values the API returns.

## Affiliate system (Phase 6)

Day-to-day, use the admin dashboard at `/admin` (see the next section). The API examples below are the same operations done by hand. Nothing is purchasable until offers exist.

### Add an offer

```bash
# 1. Log in (the seeded admin from backend/.env). Failed logins are rate limited: 10 per 15 minutes per IP.
TOKEN=$(curl -s -X POST localhost:4000/api/admin/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@macrequire.local","password":"<SEED_ADMIN_PASSWORD>"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# 2. (Optional) a country-specific affiliate program for a merchant
curl -s -X POST localhost:4000/api/admin/affiliate-programs -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"merchantId":"<merchant id>","name":"Amazon Associates India","country":"IN","affiliateId":"yourtag-21"}'

# 3. An offer for one exact configuration (ids come from GET /api/configurations and GET /api/admin/merchants)
curl -s -X POST localhost:4000/api/admin/offers -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{
  "configurationId":"<configuration id>","merchantId":"<merchant id>","programId":"<program id>",
  "price":129900,"listPrice":134900,"stock":"IN_STOCK",
  "regularUrl":"https://www.amazon.in/dp/XXXX",
  "affiliateUrl":"https://www.amazon.in/dp/XXXX?tag=yourtag-21",
  "source":"MERCHANT_FEED"}'
```

Use the `source` that is true: `MERCHANT_FEED`, `ADMIN_VERIFIED`, or `SAMPLE` for test data (shown in the UI as "Sample price (development data)").

### Product IDs and affiliate IDs (ASIN links)
- **Per offer:** a `productId` (the ASIN for Amazon, the SKU for Best Buy). It is a column in the offers CSV and a field on the offer form. With a product ID you don't need a regular URL or an affiliate URL.
- **Per merchant:** Admin → Merchants → **Link settings**: the *affiliate ID* (for Amazon, your Associates tag), the parameter that carries it (`tag`), and a *product link template* such as `https://www.amazon.com/dp/{id}`. Amazon and Best Buy are pre-filled except the ID. For networks that wrap links (Impact for Best Buy), paste the network's tracking link into the *network link template* and put `{url}` where the product link goes.
- **Built at click time:** `/api/outbound/:id` builds the link when someone clicks, so changing an affiliate ID updates every link at once. An *affiliate URL* typed on a single offer still wins (used exactly as typed). With no affiliate ID, shoppers get the plain product link and you earn nothing, which the admin shows as no "affiliate" badge.

### Country markets
Each merchant (and so each offer) belongs to one country. Visitors only see offers from their own market: product pages, catalog prices, comparison and recommendations are all filtered by country, and the questionnaire prices in that country's currency.
- **Detection:** `GET /api/market` reads the visitor's country from the host/CDN header (`CF-IPCountry`, `x-vercel-ip-country`, `cloudfront-viewer-country`, `x-appengine-country`, `x-country-code`), or falls back to the region in the browser language. Nothing is stored. Behind your own proxy, make sure one of those headers is forwarded.
- **Available markets:** a country is offered once it has at least one active, priced offer from an active merchant (upload offers for an India merchant, such as `amazon-in`, to switch India on). Everyone else, and search engines, get the default market (US), with a notice.
- **Header switch:** when more than one market is available, a country menu appears in the header. The choice is kept in the browser's local storage.
- **Server rendering:** server-rendered pages always use the default market so they can be cached and indexed consistently; the browser then switches to the visitor's market after loading.
- Add a market by adding it in `backend/src/lib/markets.ts` and the frontend `Market` type, plus merchants for that country.

### Price history
Every price or stock change on an offer writes a record (creating an offer writes the first one; re-sending the same price writes nothing). Records are never deleted. `GET /api/configurations/:id/price-history?country=US&range=30d|90d|1y|all` returns them per seller for charting: stock-only records are collapsed, records older than 2 years are thinned to one per week, and each series is capped at 400 points. The product page shows a price chart (opened on demand) once a seller has at least two price changes over at least a week. Everything shown is a price MacRequire recorded, so history starts when tracking started.

### Rules the API enforces

- URLs must be public `https://` addresses with no embedded credentials, no `localhost`/internal hosts and no IP literals. `javascript:`, `data:` and `http:` are rejected.
- Affiliate and merchant URLs are stored and redirected **exactly as entered**; they are never rewritten or have parameters added. Updating an affiliate URL takes effect immediately and does not touch product data or price history.
- An offer's country and currency come from its merchant (IN to INR, US to USD). One offer per configuration, merchant and country.
- Price, list price or stock changes append to `PriceHistory`. Passing `price` or `"verifyPrice": true` refreshes `priceVerifiedAt`. `GET /admin/offers?staleDays=7` lists offers whose price is missing or older than that.
- `DELETE /admin/offers/:id` **deactivates** (keeps click and price history). Inactive offers disappear from public APIs and their links go to `/offer-unavailable`.
- `ADMIN` can change merchants and programs; `EDITOR` can manage offers. Roles are read from the database on every request, and a deactivated admin loses access immediately.

### Outbound links and click tracking

`GET /api/outbound/:offerId?source=<recommendation|catalog|compare|detail>&result=<resultId>` records the click and sends a `302` to the stored URL. It keeps the site as referrer (`strict-origin-when-cross-origin`), sends `no-store`, and is rate limited to 60/minute per IP.

- Recorded: offer, configuration, model, merchant, offer country, source, link type (affiliate or plain), timestamp, user agent, and a **salted hash** of the IP (never the raw IP).
- Not recorded: crawlers/previews/`curl`, `HEAD` requests, repeat clicks on the same offer within 5 seconds, and clicks on inactive offers.
- `result` only counts if it is a recommendation result for that same configuration, so the funnel cannot be spoofed with another result's id. Unknown `source` values are stored as `other`.
- Tracking failures never block the redirect.

### Admin API

| Endpoint | Description |
|---|---|
| `POST /admin/auth/login`, `GET /admin/auth/me` | Obtain / check a token |
| `GET/POST /admin/merchants`, `PATCH /admin/merchants/:id` | Merchants (ADMIN to change) |
| `GET/POST /admin/affiliate-programs`, `PATCH /admin/affiliate-programs/:id` | Programs with country-specific affiliate IDs (ADMIN to change) |
| `GET/POST /admin/offers`, `GET/PATCH/DELETE /admin/offers/:id`, `GET /admin/offers/:id/price-history` | Offers (ADMIN or EDITOR to change) |
| `GET /admin/analytics/clicks?from=&to=&country=&merchantId=` | Totals, per day, merchant, country, source, top configurations and models, and the recommendation-to-click funnel |

**What analytics cannot tell you:** clicks are visits sent to merchants. Sales and commissions are known only to the affiliate network, so they are not shown or estimated. Country is the merchant offer's country, not the visitor's.

## Admin dashboard (Phase 7)

Sign in at `http://localhost:4200/admin` with the seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env`). Change that password first (Team & audit). The admin area is `noindex` and uses its own layout.

| Screen | What it does |
|---|---|
| Dashboard | Recommendations generated, most recommended and most often first, popular use cases and applications, budgets, outbound clicks by merchant/source/country, the recommendation-to-click funnel, and pricing health |
| Pricing & offers | Offers per configuration and merchant: edit price, list price, stock and links; mark a price verified; see price history; deactivate. Filter by merchant, country or missing/stale prices |
| Merchants & programs | Merchants (one country each), affiliate programs and per-country affiliate IDs |
| Catalog | Chips, models and exact configurations (with specifications); hide/show; verification level |
| Applications | Application requirements (memory, CPU/GPU demand, storage, concurrency, vendor-published vs estimate with source) and use-case weights |
| Scoring engine | Edit category weights and all rules, **preview** the effect on test users next to the live rules (nothing saved), then save, clone, or activate a rule set |
| CSV imports | Download a template, fill it in, **preview** every row, then import prices/offers or configurations |
| Team & audit | Admin users and roles, change password, and a log of every change |

**Roles.** `ADMIN` can do everything. `EDITOR` can manage offers, prices, catalog and applications, and can preview scoring, but cannot save/activate rule sets, change merchants/programs, manage users or read the audit log. Roles are read from the database on every request, and disabling an admin takes effect immediately. You cannot disable or demote yourself, and one active ADMIN must always remain.

**Safe scoring changes.** Weights and rules are validated before saving: unknown settings, wrong types, out-of-range values, malformed or unsorted curves, and inconsistent combinations (for example the minimum-memory score above the target score) are rejected with the setting named. `version` is managed by the system. Saving a live rule set affects recommendations immediately, so use Preview first.

**Loading prices from a spreadsheet.**
1. CSV imports → Prices & offers → pick the merchant → *Download template* (every active configuration, with current prices filled in).
2. Fill `price` (and `regularUrl` for new offers) in a spreadsheet. Blank cells mean “leave as is”. Prices are in the merchant's currency, before tax. Use `source` truthfully (`ADMIN_VERIFIED`, `MERCHANT_FEED`, or `SAMPLE` for test data).
3. Upload, **Preview**, fix any errors, then **Import**. A file with errors imports nothing unless you tick *Skip invalid rows*. Importing the same file twice changes nothing. Every price change is kept in the history.

**Shopper country.** The questionnaire is US-first (`frontend/src/environments/environment.ts`, `countries: ['US']`). The backend and data model still support India; add `'IN'` there to show the selector again.

**Security notes.** Admin sessions use a signed token (HS256 only) kept in `sessionStorage`; changing a password or deactivating an account ends that person's other sessions. Only ADMINs can set an affiliate URL override; EDITORs manage prices, stock and product IDs. CSV uploads are only read after sign-in, and ordinary requests are limited to 100 KB. The website sends a Content-Security-Policy that allows scripts only from itself and by hash; if the browser must call extra addresses, list them in `CSP_CONNECT_SRC`. Recommendation links use random ids. Not covered yet: two-factor sign-in, and rate-limit counters are kept in each server's memory (fine for one instance). The `prisma` command-line tool has a build-time advisory (`deepmerge-ts`) that needs the Prisma 7 upgrade; it does not run in production.

## Deployment
See [DEPLOY.md](DEPLOY.md) for the step-by-step Render setup (`render.yaml` is the Blueprint). In production the API refuses to start with placeholder secrets, non-https origins, or without `TRUST_PROXY_HOPS`, and the website's public addresses come from `PUBLIC_API_URL` / `PUBLIC_SITE_URL` at build time.

## SEO, AEO, GEO and legal pages (Phase 8)

The frontend is now **server-side rendered** (Angular SSR on Express), so search and AI crawlers that do not run JavaScript receive full HTML. It needs a **Node host**, not static hosting.

```bash
cd frontend && npm run build
PORT=4200 SITE_URL=https://your-domain.com API_URL=https://api.your-domain.com/api node dist/frontend/server/server.mjs
```

| Variable | Purpose |
|---|---|
| `SITE_URL` | Public origin. Used for canonical URLs, sitemap, llms.txt and social cards. Its host is allowed automatically. |
| `API_URL` | Backend API base URL the server calls (for rendering and the sitemap). |
| `PORT` | Listen port (default 4200). |
| `ALLOWED_HOSTS` | Extra comma-separated host names Angular should accept (e.g. a www alias). Other hosts get a 400. |
| `BLOCK_AI_TRAINING` | `true` blocks AI training crawlers in robots.txt. AI search and answer crawlers stay allowed. |

Before launch:
- Set `environment.siteUrl`, `environment.apiUrl` and `environment.contactEmail` in `frontend/src/environments/environment.ts` (the contact line stays hidden until an email is set). On the backend set `FRONTEND_URL` for CORS.
- Add `googleSiteVerification` / `bingSiteVerification` tokens, then submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- The privacy policy and terms are plain-language drafts that match what the site does today (no cookies, no analytics, hashed IPs). Have a lawyer review them, and update the privacy policy if you add analytics.

What is generated: per-page titles, descriptions, canonical URLs, Open Graph and Twitter cards, JSON-LD (Organization, WebSite, BreadcrumbList, FAQPage, Article, ItemList, Product), `/robots.txt`, `/sitemap.xml` (products come from the API), `/llms.txt`, and real 404 status codes. Private pages (`/admin`, `/find`, `/results`, `/compare`, `/offer-unavailable`) are client-rendered and sent with `X-Robots-Tag: noindex`. Product structured data includes prices only when real (non-SAMPLE) offers exist. Guide and methodology pages read live data, so they cannot drift from the catalog.

GEO note: nothing guarantees an AI engine will cite the site. The pages are answer-first, factual and crawlable; track results in Search Console and Bing Webmaster Tools.

### Product images
Images are stored per model (`imageUrl`). Set them in Admin → CSV imports → **Product images**: download the model list, fill `imageUrl` with public https links (blank keeps the current image, `CLEAR` removes it), preview (each image is shown so you can see whether it loads), then import. A link containing commas must be quoted in the CSV, as spreadsheet apps do automatically. You can also host images yourself: put files in `frontend/public/images/` (WebP, PNG, JPEG, AVIF or SVG; use a 5:4 shape such as 1000×800px, with the laptop filling most of the frame; local images are not zoomed or trimmed) and use `/images/your-file.webp` as the `imageUrl`. Files are served by the site and deployed with each build, so a new image needs a rebuild. If an image is missing or fails to load, the site shows a grey box with the screen size. Only use images you have the right to show; the current links point to Apple's image CDN.

## Local database without Docker

Any PostgreSQL 14+ works. Point `DATABASE_URL` in `backend/.env` at it.
