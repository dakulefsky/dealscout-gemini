# DealScout

DealScout is an Amazon affiliate deals application focused on verified price drops, recent price checks, observed price history, and selective editorial picks.

## Current architecture

- **Frontend:** React 18, Vite, React Router, Tailwind CSS
- **Backend:** Express 5 running from `server.js`
- **Primary database:** PostgreSQL when `DATABASE_URL` is configured
- **Local fallback:** JSON-backed repositories for development
- **Auth:** JWT + bcrypt; the shopper site does not expose a general login surface
- **Deal sources:** Rainforest API and optional Amazon PA-API through a fail-closed provider router
- **Price history:** real recorded observations, stored in PostgreSQL or the JSON fallback
- **Email:** SMTP via Nodemailer for verification/reset delivery

The production server serves the built frontend and API from the same Node process.

## Requirements

Use Node.js 24 to match the repository Quality workflow. Install dependencies from the repository root:

```bash
npm install
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

GitHub's **Quality** workflow runs install, lint, tests, and build on pull requests.

## Production deployment

Build first, then start the Node server:

```bash
npm install --no-audit --no-fund
npm run build
NODE_ENV=production npm start
```

Production requires a `JWT_SECRET` of at least 32 characters. Set `FRONTEND_URL` to the public site origin so CORS, canonical URLs, sitemap URLs, and password-reset links use the correct host.

### Core environment variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Use `production` in production. |
| `PORT` | HTTP port; defaults to `3000`. |
| `FRONTEND_URL` | Public origin, e.g. `https://example.com`. |
| `JWT_SECRET` | JWT signing secret; minimum 32 characters in production. |
| `DATABASE_URL` | PostgreSQL connection string. Strongly recommended for production. |
| `PGSSL` | Set to `disable` only when the database explicitly does not use SSL. |
| `PG_POOL_MAX` | PostgreSQL pool size; defaults to `5`. |
| `ADMIN_EMAIL` | Optional first-admin bootstrap email for a fresh production database. |
| `ADMIN_PASSWORD` | Optional first-admin bootstrap password; 12-200 characters. Ignored once an admin exists. |
| `AMAZON_ASSOCIATE_TAG` | Amazon Associates tag used for outbound affiliate URLs. |
| `DEAL_DATA_PROVIDER` | `auto`, `rainforest`, or `amazon_paapi` in production. `curated` is development-only. |
| `RAINFOREST_API_KEY` | Rainforest API key for strict product lookup/discovery. |
| `EDITORIAL_HOLDBACK_PERCENT` | Percentage of otherwise auto-approvable deals held for editorial review. |
| `ALLOW_PUBLIC_REGISTRATION` | Leave unset/false for the current private-admin model. |

### SMTP

Set all of these for email delivery:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

Password-reset emails also require `FRONTEND_URL`.

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

- Public deals must be approved, source-verified, and not expired.
- Rainforest imports require a verifiable original/sale price pair.
- Production does not fall back to the legacy scraper or curated demo provider.
- Shopper-facing API responses omit legacy ratings, reviews, generated summaries, pros/cons, and raw source payloads.
- Product structured data does not include customer ratings or reviews.
- `InStock` structured data is only emitted for very recently checked deals.
- Deals whose successful price check is more than seven days old are omitted from the sitemap until refreshed.

## Price verification and history

The scheduler rotates verification oldest-first so the newest deals cannot monopolize the verification batch. A failed provider attempt advances queue position without pretending that `price_check_at` was refreshed.

Successful observations are stored in the price-history service. Deal pages only show an observed price-history section when at least two real observations exist; no simulated history is presented to shoppers.

## SEO endpoints

Production exposes:

- `/robots.txt`
- `/sitemap.xml`
- route-specific initial HTML metadata for home, categories, and verified deal pages
- Product JSON-LD without synthetic ratings/reviews
- canonical URLs and deal Open Graph images when available

Admin and API routes are excluded from crawling. Technical SEO can improve crawlability and eligibility, but it does not guarantee search ranking.

## Amazon Associates disclosure

The shopper-facing disclosure includes the required statement:

> As an Amazon Associate I earn from qualifying purchases.

Final price and availability are determined on Amazon.
