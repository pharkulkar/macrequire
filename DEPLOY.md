# Deploying MacRequire on Render

Two web services (API and website) and one PostgreSQL database, all in the **same region** (the Blueprint uses `virginia`).
Use paid plans for the two web services so they never sleep (Buy buttons go through the API).

## 1. Put the code on GitHub
Render deploys from a Git repository. `.env` files are already ignored; never commit them.

## 2. Create the database
Dashboard → New → PostgreSQL. Same region as the services. Pick a paid plan with backups. Copy the **Internal Database URL**.

## 3. Create the services
Dashboard → New → Blueprint → choose the repository. Render reads `render.yaml` and asks for the values marked `sync: false`.
Start with the `*.onrender.com` addresses Render shows, then switch to your domain in step 7.

| Variable | Service | Value |
|---|---|---|
| `DATABASE_URL` | API | the database's Internal Database URL |
| `CORS_ORIGIN`, `FRONTEND_URL` | API | the website address (`https://…`) |
| `SITE_URL`, `PUBLIC_SITE_URL` | website | the website address |
| `PUBLIC_API_URL` | website | the API address plus `/api` (what visitors' browsers call) |
| `API_URL` | website | the same API address plus `/api` |
| `ALLOWED_HOSTS` | website | the website's host names, comma separated, e.g. `macrequire-web.onrender.com,www.example.com` |
| `CONTACT_EMAIL` | website | a monitored address (shown on the legal pages) |
| `CSP_CONNECT_SRC` | website | optional: extra addresses the browser may call, space separated (the API address is added automatically) |

`PUBLIC_*` values are baked into the website at build time, so changing them needs a redeploy of the website.
`JWT_SECRET` and `IP_HASH_SALT` are generated for you. The API refuses to start in production with placeholder secrets,
non-https addresses, or without `TRUST_PROXY_HOPS`.

The API runs `prisma migrate deploy` before each deploy and checks `/api/health`.

## 4. Load the data
**Recommended (clean start):** in the API service → Shell:
```
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a strong password, 12+ chars' NODE_ENV=production npm run db:seed
```
This loads the catalog, applications and use cases and creates your admin account (it refuses weak passwords in production).
Then sign in at `/admin` and import prices (Admin → CSV imports), merchant link settings and product images.

**Shortcut:** copy your local database (includes test clicks and your local admin). Use the database's *External Database URL*:
```
pg_dump --no-owner --no-acl "$LOCAL_DATABASE_URL" | psql "$RENDER_EXTERNAL_DATABASE_URL"
```
Afterwards change the admin password and remove test data.

## 5. Product images
Files in `frontend/public/images/` are deployed with the website. Use `/images/your-file.png` as the image path.

## 6. Check the proxy setting (important)
The rate limits and click hashing need the visitor's real IP. `TRUST_PROXY_HOPS` is how many proxies sit in front of the API
(Render's edge, plus Cloudflare if you use it). Sign in, then call the diagnostics endpoint from your own computer:
```
TOKEN=$(curl -s -X POST https://YOUR-API/api/admin/auth/login -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"…"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s https://YOUR-API/api/admin/diagnostics/network -H "authorization: Bearer $TOKEN"
```
`ip` must be **your own public address** (search "what is my IP"). If it is a different address, change `TRUST_PROXY_HOPS`
(+1 or -1) in the API's environment and check again. Repeat after adding Cloudflare or a custom domain.

## 7. Domain and Cloudflare
1. Add your domain to each service (Settings → Custom Domains), for example `www.example.com` for the website and `api.example.com` for the API.
2. Optional but recommended: put the domain on Cloudflare (SSL mode **Full (strict)**). It adds the visitor's country, caching and DDoS protection.
3. Update the variables from step 3 to the real addresses, redeploy the website, and repeat step 6.

## 8. Before announcing
- Set up the checklist in the README ("Before launch"): contact email, lawyer review of the legal pages, search-console tokens and sitemap, affiliate IDs under Admin → Merchants.
- Turn on database backups and uptime alerts in Render.
