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
- `EXPO_PUBLIC_API_URL` — mobile build-time API origin. Production mobile builds must use the deployed HTTPS API origin.

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

SMTP credentials, provider credentials, admin bootstrap password, publication transport secrets, and mobile signing credentials should be mounted from the deployment/CI secret store rather than committed to GitHub.

## Scaling

The HTTP service is safe to run with multiple replicas because scheduled provider work uses PostgreSQL advisory locks. Publication jobs are claimed with database leases and queue insertion is idempotent. WhatsApp Status cycles additionally use a PostgreSQL advisory lock plus durable publication-history spacing so horizontally scaled Status workers cannot intentionally publish in parallel.

Do not deploy product surfaces against separate databases: website, app, and publishing must share one source of truth.

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
- Generic web/app workers default to 30-second polling and accept bounded faster polling.
- WhatsApp Status defaults to a 30-minute poll and a 30-minute durable minimum publication spacing. `PUBLICATION_MIN_SPACING_SECONDS` may be configured within its bounded Status range, but publication history remains authoritative across restarts.
- Status publishes at most one job per cycle even if `PUBLICATION_MAX_PER_CYCLE` is configured higher. This prevents a generic high-throughput setting from dumping multiple Status posts at once.
- `PUBLICATION_QUEUE_BATCH` and `PUBLICATION_CANDIDATE_LIMIT` bound candidate/queue work independently from the number of actual Status publishes.
- `PUBLICATION_WEBHOOK_TIMEOUT_MS` bounds transport latency.

Each cycle selects already-public verified candidates, applies the channel's stricter distribution policy, suppresses recently published ASINs, enqueues idempotently, leases due jobs, revalidates the current deal and verification snapshot, composes factual content, and only then calls the transport. The webhook receives a versioned payload plus an `Idempotency-Key` header. A transport failure changes only publication retry/job state; it never changes deal truth.

The webhook is a transport boundary, not a way around DealScout's trust model. A WhatsApp bridge may translate the prepared image/caption into a provider-specific API call, but it must not verify prices, invent claims, select deals, or mutate lifecycle state.

Until a real WhatsApp Status bridge/provider is configured and tested, the web/API deployment remains healthy without the worker. Do not point production at a mock webhook merely to make queue metrics look active.

## Mobile release

The native app lives under `apps/mobile`. Its dependency lock and Expo all-platform export are checked by the `Mobile Quality` workflow. See `apps/mobile/README.md` for EAS/project/store prerequisites.

Before building a production binary:

1. Run the backend release smoke against the exact production/staging API origin the binary will use.
2. Confirm the release commit passes both `Quality` and `Mobile Quality`.
3. Verify the EAS project, iOS bundle identifier, Android package, signing identities, app icons/store artwork, privacy/support URLs, and store metadata are the real production values.
4. Set `EXPO_PUBLIC_API_URL` to the intended HTTPS API origin in the EAS build environment. Never place secrets in `EXPO_PUBLIC_*` variables.
5. Build a preview/internal binary first and verify feed, detail, saved deals, search, and Amazon outbound behavior on physical iOS/Android devices before store submission.

## Release gate

Every release should pass the repository `Quality` workflow (`npm ci`, lint, tests, production build, production container). Mobile-affecting releases must also pass `Mobile Quality` (`npm ci` from the mobile lock plus Expo all-platform export).

After deploying a web/API revision, run the read-only external smoke harness against its externally reachable origin before shifting all traffic:

```bash
npm run smoke:release -- https://api.example.com
# or
DEALSCOUT_SMOKE_URL=https://api.example.com npm run smoke:release
```

The smoke command verifies:

- `/api/health` liveness;
- `/api/ready` database-backed readiness;
- `/api/v1/meta` version/tracing headers;
- the cursor feed response contract;
- one public deal-detail lookup when public inventory exists.

The default smoke is intentionally read-only and does not log in as admin, invoke provider diagnostics, publish a job, or mutate catalog state.

After the public smoke passes, perform the privileged operator checks separately: admin sign-in, publication-health visibility, and one provider diagnostic. Keep credentials out of command history/log output.

For a publication-worker rollout, first use `PUBLICATION_RUN_MODE=once` against the real transport in a controlled environment and confirm one known eligible job reaches the external channel with its external publication identity recorded. For WhatsApp Status, also verify that a second immediate cycle is cadence-deferred rather than posting again. Only then switch to continuous or scheduled production execution.
