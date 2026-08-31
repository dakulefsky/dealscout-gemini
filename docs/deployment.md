# DealScout production deployment

DealScout is designed as one shared deal-intelligence backend with multiple product surfaces:

- **Website** — the React build is served by the Node/Express production container.
- **Mobile app** — consumes the same public API/feed contracts as the website; it does not own deal truth or ranking data.
- **Automated publishing** — consumes the same verified deals through the durable publication queue. Channel transports are adapters and must not mutate deal lifecycle truth.

## Required production shape

Production must use PostgreSQL. The JSON database is intentionally development-only and is not a supported production fallback. Every web/API replica and every future publication worker must point at the same PostgreSQL database.

At startup the web/API process:

1. validates required production configuration;
2. verifies PostgreSQL connectivity;
3. initializes deal, account, category, bookmark, editorial, activity, refresh-state, price-history, and publication-queue schemas;
4. applies production deal hardening;
5. only then starts accepting traffic.

`GET /api/health` is a process liveness check and does not depend on PostgreSQL. `GET /api/ready` is a readiness check and returns HTTP 503 when shared storage is unavailable.

## Container

Build from the repository root:

```bash
docker build -t dealscout .
```

Run locally against a production-like database:

```bash
docker run --rm -p 8080:8080 \
  -e JWT_SECRET='replace-with-at-least-32-characters' \
  -e AMAZON_ASSOCIATE_TAG='your-tag' \
  -e DATABASE_URL='postgresql://...' \
  -e PGSSL='verify-full' \
  -e FRONTEND_URL='https://example.com' \
  dealscout
```

The runtime image uses Node 24, installs from the committed npm lock with `npm ci`, runs as the non-root `node` user, and exposes port 8080 by default.

## Cloud Run + Cloud SQL

For Cloud Run, prefer the native Cloud SQL Unix socket configuration rather than embedding a database password in a URL:

- `CLOUD_SQL_CONNECTION_NAME`
- `DB_USER`
- `DB_PASSWORD` (prefer Secret Manager)
- `DB_NAME`
- `PG_POOL_MAX`

Attach the Cloud SQL instance to the Cloud Run service and grant the runtime service account Cloud SQL Client access. The application uses `/cloudsql/<connection-name>` when all native Cloud SQL settings are present.

Suggested health probes:

- liveness: `/api/health`
- startup/readiness: `/api/ready`

Do not send traffic to a revision whose readiness endpoint is returning 503.

## Secrets and configuration

Keep secrets outside the image and source tree. At minimum, production needs:

- a 32+ character `JWT_SECRET`;
- an `AMAZON_ASSOCIATE_TAG`;
- PostgreSQL or complete Cloud SQL configuration;
- credentials for the selected verified deal-data provider.

`FRONTEND_URL`, when supplied in production, must be an absolute HTTPS URL. It is used for canonical URLs, CORS, and password-reset links.

SMTP credentials, provider credentials, admin bootstrap password, and any future publication transport secret should be mounted from the deployment secret store rather than committed to GitHub.

## Scaling

The HTTP service is safe to run with multiple replicas because scheduled provider work uses PostgreSQL advisory locks and publication jobs use database leases. Do not deploy separate copies with separate databases: website, app, and publishing must share one source of truth.

The default PostgreSQL pool is intentionally small (`PG_POOL_MAX=5`). Size the Cloud Run maximum instance count and database connection limit together before increasing either value.

## Publishing channel deployment

The publication queue and worker domain are production-ready independently of any specific transport. A channel transport must implement the publication adapter contract and return an external publication identifier when possible.

Do **not** make a transport adapter responsible for verifying prices, deciding deal eligibility, or updating deal lifecycle state. Those remain in the shared DealScout backend. A failed channel publish should only affect publication job state and retry scheduling.

Until a real WhatsApp Status transport is configured and tested, the web/API deployment should remain healthy without one. Do not substitute a mock transport in production merely to make the queue appear active.

## Release gate

Every release should pass the repository Quality workflow (`npm ci`, lint, tests, production build). For a production rollout, additionally verify:

```text
/api/health -> 200 {"status":"ok"}
/api/ready  -> 200 {"status":"ready"}
```

Then validate one public feed request, one admin sign-in, and one provider diagnostic before shifting all traffic to the new revision.
