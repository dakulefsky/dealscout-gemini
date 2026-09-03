# DealScout

DealScout is an Amazon affiliate deals application focused on verified price drops, recent price checks, price alerts, and selective editorial picks.

## Current architecture

- **Frontend:** React 18, Vite, React Router, Tailwind CSS
- **Backend:** Express 5 running from `server.js`
- **Primary database:** PostgreSQL in production
- **Local fallback:** JSON-backed repositories for development
- **Auth:** JWT + bcrypt; the shopper site does not expose a general login surface
- **Deal sources:** Rainforest API and optional Amazon PA-API through a fail-closed provider router
- **Price alerts:** verified price observations evaluate active alerts without retaining shopper price history
- **Email:** SMTP via Nodemailer for verification/reset delivery

The production container can serve the built frontend and API from the same Node process. A separately hosted frontend is also supported when `VITE_API_URL` is set at build time and the frontend origin is present in `CORS_ORIGINS`.

## Requirements

Use Node.js 24 to match the repository Quality workflow. Install dependencies from the committed npm lockfile at the repository root:

```bash
npm ci
```

## Local development

Copy the root environment template and fill in the values you need:

```bash
cp .env.example .env
npm run dev
```

The default port is `3000`. In development, `server.js` runs Express and mounts Vite in middleware mode, so a second frontend server is not required.

Useful checks before opening a PR or deploying:

```bash
npm run lint
npm test
npm run build
```

GitHub's **Quality** workflow runs locked install, lint, tests, frontend build, and a production Docker build on pull requests.

## Production deployment

Build first, then start the Node server:

```bash
npm ci --no-audit --no-fund
npm run build
NODE_ENV=production npm start
```

Production requires PostgreSQL, a `JWT_SECRET` of at least 32 characters, an Amazon Associate tag, and valid HTTPS public/browser origins. New deployments should set `PUBLIC_WEB_URL` to the canonical website origin and `CORS_ORIGINS` to the browser origins allowed to call the API. `FRONTEND_URL` remains a compatibility fallback for older deployments.

When the frontend is hosted separately from the API, set `VITE_API_URL` in the frontend build environment to the deployed API origin. This is a build-time public URL, not a secret.

`TRUST_PROXY` controls how many reverse-proxy hops Express trusts when deriving `req.ip`, which is also the key for the baseline API rate limiter. Production defaults to one hop for backward compatibility. Set it to `0`/`off` when the Node process is directly exposed, or to the exact integer hop count (1-5) for the deployment topology. DealScout intentionally does not accept a trust-all boolean.

### Core environment variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Use `production` in production. |
| `PORT` | HTTP port; defaults to `3000`; the production Docker image sets `8080`. |
| `PUBLIC_WEB_URL` | Canonical public website origin and password-reset destination. Use HTTPS in production. |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API. Use HTTPS in production. |
| `FRONTEND_URL` | Compatibility fallback for older deployments; prefer `PUBLIC_WEB_URL`. |
| `VITE_API_URL` | Optional frontend build-time API origin when frontend and API are on different hosts. |
| `TRUST_PROXY` | Trusted reverse-proxy hop count (`0`-`5`); production defaults to `1`. |
| `JWT_SECRET` | JWT signing secret; minimum 32 characters in production. |
| `CLOUD_SQL_CONNECTION_NAME` | Cloud SQL instance connection name for native Cloud Run Unix-socket access. |
| `DB_USER` | PostgreSQL user when using native Cloud SQL configuration. |
| `DB_PASSWORD` | PostgreSQL password; use Secret Manager or equivalent in production. |
| `DB_NAME` | PostgreSQL database name when using native Cloud SQL configuration. |
| `DATABASE_URL` | Alternative PostgreSQL connection string for non-Cloud-SQL deployments. |
| `PGSSL` | TLS mode for `DATABASE_URL`; native Cloud SQL Unix sockets do not use nested TLS. |
| `PG_POOL_MAX` | PostgreSQL pool size; defaults to `5`. |
| `ADMIN_EMAIL` | Optional first-admin bootstrap email for a fresh production database. |
| `ADMIN_PASSWORD` | Optional first-admin bootstrap password; 12-200 characters. Ignored once an admin exists. |
| `AMAZON_ASSOCIATE_TAG` | Amazon Associates tag used for outbound affiliate URLs. |
| `DEAL_DATA_PROVIDER` | `auto`, `rainforest`, or `amazon_paapi` in production. `curated` is development-only. |
| `RAINFOREST_API_KEY` | Rainforest API key for strict product lookup/discovery. |
| `EDITORIAL_HOLDBACK_PERCENT` | Percentage of otherwise auto-approvable deals held for editorial review. |
| `ALLOW_PUBLIC_REGISTRATION` | Leave unset/false for the current private-admin model. |

For Cloud Run + Cloud SQL, prefer the native Cloud SQL settings (`CLOUD_SQL_CONNECTION_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) and attach the Cloud SQL instance to the service. Every runtime service account that connects to the database needs Cloud SQL Client access.

### SMTP

Set all of these for email delivery:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

Password-reset emails use the canonical public website origin from `PUBLIC_WEB_URL` (or the legacy `FRONTEND_URL` fallback).

### Optional Amazon PA-API

PA-API is supported but is not required when Rainforest is the active provider:

- `AMAZON_PAAPI_ACCESS_KEY`
- `AMAZON_PAAPI_SECRET_KEY`
- `AMAZON_PAAPI_PARTNER_TAG`
- `AMAZON_PAAPI_REGION`
- `AMAZON_PAAPI_HOST`

### Optional Gemini integration

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

AI output is not treated as verified Amazon source data. Verified ingest paths intentionally clear generated summaries, pros/cons, ratings, and reviews before persistence.

## Admin access

The private admin entrance is:

```text
/admin
```

If you are signed out, `/admin` redirects to `/admin/access`. The public site does not advertise a shopper login or registration page, and public registration is disabled unless `ALLOW_PUBLIC_REGISTRATION=true` is explicitly set.

There is **no production default admin password** to rely on. For a fresh production PostgreSQL database with no admin account, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first start. DealScout will create or promote that email as the first verified admin only when no admin already exists. Existing admin credentials are never overwritten by the bootstrap path.

After the first successful admin login, remove `ADMIN_PASSWORD` from the deployment environment. The old JSON development seed contains legacy demo credentials/content, but production hardening removes the default seeded admin; do not use that legacy seed as production account provisioning.

## Deal-data integrity rules

DealScout intentionally fails closed:

- Public deals must be approved, source-verified, not expired, and have a valid positive discount price pair.
- Shopper-visible price claims expire after 24 hours without a successful provider refresh.
- Rainforest imports require a verifiable original/sale price pair.
- Production does not fall back to the legacy scraper or curated demo provider.
- Shopper-facing API responses omit legacy ratings, reviews, generated summaries, pros/cons, raw source payloads, and observed price history.
- Product structured data does not include customer ratings or reviews.
- Web, app, and WhatsApp Status share the same 24-hour public price freshness ceiling; WhatsApp applies additional quality/image/discount rules.

## Price verification and alerts

The scheduler runs discovery before single-ASIN verification so one bulk provider request can refresh many existing products before more expensive individual checks are spent. Verification rotates oldest successful price checks first and uses a bounded dynamic batch sized against the 24-hour public freshness target. Provider budget/cooldown conditions stop the remaining verification batch rather than burning requests.

Successful verified observations evaluate active price alerts. DealScout does not retain or expose shopper price-history curves.

## SEO endpoints

Production exposes:

- `/robots.txt`
- `/sitemap.xml`
- route-specific initial HTML metadata for home, categories, and verified deal pages
- Product JSON-LD without synthetic ratings/reviews
- canonical URLs and deal Open Graph images when available

Only deals that pass the shared public freshness policy are eligible for deal sitemap entries and price-bearing metadata. Admin and API routes are excluded from crawling. Technical SEO can improve crawlability and eligibility, but it does not guarantee search ranking.

## Amazon Associates disclosure

The shopper-facing disclosure includes the required statement:

> As an Amazon Associate I earn from qualifying purchases.

Final price and availability are determined on Amazon.

For the full production topology, Cloud Run/Cloud SQL guidance, publication worker settings, mobile release requirements, and smoke checks, see `docs/deployment.md`.
