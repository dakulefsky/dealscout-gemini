# DealScout production deployment

DealScout is designed as one shared deal-intelligence backend with multiple product surfaces:

- **Website** — the React build is served by the Node/Express production container.
- **Mobile app** — consumes the same public API/feed contracts as the website; it does not own deal truth or ranking data.
- **Automated publishing** — consumes the same verified deals through the durable publication queue. Channel transports are adapters and must not mutate deal lifecycle truth.

## Required production shape

Production must use PostgreSQL. The JSON database is intentionally development-only and is not a supported production fallback. Every web/API replica and every publication worker must point at the same PostgreSQL database.

At startup each process validates only the configuration its role needs, verifies PostgreSQL connectivity, initializes shared operational schemas, and applies production deal hardening. The web role additionally validates JWT, affiliate, public-origin, and HTTP configuration; the publication-worker role does not need website-only secrets.

`GET /api/health` is a web-process liveness check and does not depend on PostgreSQL. `GET /api/ready` is a web-process readiness check and returns HTTP 503 when shared storage is unavailable.

## Product origins and API clients

Do not use one hostname setting for every product surface. Configure these separately:

- `PUBLIC_WEB_URL` — canonical public website origin and password-reset destination, for example `https://deals.example.com`.
- `CORS_ORIGINS` — comma-separated browser origins allowed to call the API, for example `https://deals.example.com,https://admin.example.com`.
- `VITE_API_URL` — optional website build-time API base URL when the web frontend is not served from the API origin.

`FRONTEND_URL` remains a compatibility fallback for older deployments but new deployments should use `PUBLIC_WEB_URL`.

CORS is a browser boundary. Native mobile clients, publication workers, CLI jobs, and other server-to-server callers normally do not send an `Origin` header and are allowed through the CORS middleware; they must still satisfy the API's normal authentication and authorization rules. Never treat CORS as authentication.

## Container

Build one production image from the repository root:

```bash
docker build -t dealscout .
```

The same image contains both process entrypoints:

```text
node server.js             # website + API
node publication-worker.js # publication worker
```

Run the web/API role locally against a production-like database:

```bash
docker run --rm -p 8080:8080 \
  -e JWT_SECRET='replace-with-at-least-32-characters' \
  -e AMAZON_ASSOCIATE_TAG='your-tag' \
  -e DATABASE_URL='postgresql://...' \
  -e PGSSL='verify-full' \
  -e PUBLIC_WEB_URL='https://example.com' \
  -e CORS_ORIGINS='https://example.com' \
  dealscout
```

The runtime image uses Node 24, installs from the committed npm lock with `npm ci`, runs as the non-root `node` user, and exposes port 8080 for the web role.

## Cloud Run + Cloud SQL

For Cloud Run, prefer the native Cloud SQL Unix socket configuration rather than embedding a database password in a URL:

- `CLOUD_SQL_CONNECTION_NAME`
- `DB_USER`
- `DB_PASSWORD` (prefer Secret Manager)
- `DB_NAME`
- `PG_POOL_MAX`

Attach the Cloud SQL instance to every web or worker deployment that uses the shared database and grant each runtime service account Cloud SQL Client access. The application uses `/cloudsql/<connection-name>` when all native Cloud SQL settings are present.

Suggested web health probes:

- liveness: `/api/health`
- startup/readiness: `/api/ready`

Do not send traffic to a web revision whose readiness endpoint is returning 503.

## Secrets and configuration

Keep secrets outside the image and source tree. The web role needs:

- a 32+ character `JWT_SECRET`;
- an `AMAZON_ASSOCIATE_TAG`;
- PostgreSQL or complete Cloud SQL configuration;
- credentials for the selected verified deal-data provider.

The publication worker needs shared PostgreSQL plus its publication transport configuration. It intentionally does not require the JWT signing secret, browser origins, or website canonical URL.

`PUBLIC_WEB_URL`, when supplied in production, must be an absolute HTTPS origin. `CORS_ORIGINS` entries must also use HTTPS in production. Use multiple CORS origins when separate website/admin browser products need the same API; do not widen CORS to `*` when credentialed requests are enabled.

SMTP credentials, provider credentials, admin bootstrap password, and publication transport secrets should be mounted from the deployment secret store rather than committed to GitHub.

## Scaling

The HTTP service is safe to run with multiple replicas because scheduled provider work uses PostgreSQL advisory locks. Publication workers are independently safe to scale because queue insertion is idempotent and jobs are claimed with database leases. Do not deploy product surfaces against separate databases: website, app, and publishing must share one source of truth.

The default PostgreSQL pool is intentionally small (`PG_POOL_MAX=5`). Size total web + worker replica counts and database connection limits together before increasing either value.

## Publication worker

Run the worker from the same production image with:

```bash
npm run publisher
```

Required worker settings:

- `PUBLICATION_CHANNEL` — `web`, `app`, or `whatsapp_status`.
- `PUBLICATION_TRANSPORT=webhook`.
- `PUBLICATION_WEBHOOK_URL` — HTTPS endpoint of the channel transport bridge in production.
- `PUBLICATION_WEBHOOK_TOKEN` — bearer secret with at least 16 characters in production.

Operational controls are bounded by configuration:

- `PUBLICATION_RUN_MODE=continuous` polls until SIGTERM/SIGINT.
- `PUBLICATION_RUN_MODE=once` performs one bounded candidate/queue/publish cycle and exits, which is suitable for a scheduled job runner.
- `PUBLICATION_POLL_MS` controls continuous polling (1s–5m).
- `PUBLICATION_QUEUE_BATCH`, `PUBLICATION_CANDIDATE_LIMIT`, and `PUBLICATION_MAX_PER_CYCLE` bound work per cycle.
- `PUBLICATION_WEBHOOK_TIMEOUT_MS` bounds transport latency.

Each cycle selects already-public verified candidates, applies the channel's stricter distribution policy, suppresses recently published ASINs, enqueues idempotently, leases due jobs, revalidates the current deal and verification snapshot, composes factual content, and only then calls the transport. The webhook receives a versioned payload plus an `Idempotency-Key` header. A transport failure changes only publication retry/job state; it never changes deal truth.

The webhook is a transport boundary, not a way around DealScout's trust model. A WhatsApp bridge may translate the prepared image/caption into a provider-specific API call, but it must not verify prices, invent claims, select deals, or mutate lifecycle state.

Until a real WhatsApp Status bridge/provider is configured and tested, the web/API deployment remains healthy without the worker. Do not point production at a mock webhook merely to make queue metrics look active.

## Release gate

Every release should pass the repository Quality workflow (`npm ci`, lint, tests, production build). For a production web rollout, additionally verify:

```text
/api/health -> 200 {"status":"ok"}
/api/ready  -> 200 {"status":"ready"}
```

Then validate one `/api/v1` public feed request, one admin sign-in, and one provider diagnostic before shifting all web traffic.

For a publication-worker rollout, first use `PUBLICATION_RUN_MODE=once` against the real transport in a controlled environment and confirm one known eligible job reaches the external channel with its external publication identity recorded. Only then switch to continuous or scheduled production execution.
