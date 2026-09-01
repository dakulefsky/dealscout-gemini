# DealScout Google Cloud release

DealScout production uses one immutable container image with two runtime roles:

- **Website + API:** a public Cloud Run service running the image default command (`node server.js`).
- **WhatsApp Status publisher:** one Cloud Run worker-pool instance running `node publication-worker.js` continuously.

Both roles attach to the same Cloud SQL instance. The publisher has no public HTTP endpoint and must not receive web-only authentication/provider secrets.

## Build first

Build and push the image through the normal release pipeline. Set `GCP_IMAGE` to the immutable Artifact Registry image for the exact release commit or digest; do not deploy a floating `latest` tag.

The repository Quality workflow must be green before deployment. Run the three-surface configuration gate as well:

```bash
npm run launch:check
```

## Runtime inputs

The release command accepts configuration through environment variables. Secret variables contain **Secret Manager references**, never secret values.

Required non-secret release settings:

```text
GCP_PROJECT_ID
GCP_IMAGE
CLOUD_SQL_CONNECTION_NAME
PUBLIC_WEB_URL
CORS_ORIGINS
AMAZON_ASSOCIATE_TAG
DEAL_DATA_PROVIDER
WAHA_BASE_URL
WAHA_SESSION
```

Optional release settings include `GCP_REGION` (defaults to `us-central1`), `GCP_WEB_SERVICE`, `GCP_PUBLISHER_POOL`, `GCP_RUNTIME_SERVICE_ACCOUNT`, publication thresholds/polling values, and `RAINFOREST_DOMAIN`.

Secret maps use gcloud's `ENV_VAR=SECRET_NAME:VERSION` format:

```text
GCP_DB_SECRETS=DB_USER=dealscout-db-user:latest,DB_PASSWORD=dealscout-db-password:latest,DB_NAME=dealscout-db-name:latest
GCP_WEB_SECRETS=JWT_SECRET=dealscout-jwt:latest,RAINFOREST_API_KEY=dealscout-rainforest:latest
GCP_PUBLISHER_SECRETS=WAHA_API_KEY=dealscout-waha-key:latest
```

`GCP_DB_SECRETS` is mounted into both roles. `GCP_WEB_SECRETS` is mounted only into the website/API service. `GCP_PUBLISHER_SECRETS` is mounted only into the Status worker. This keeps the JWT signing secret and provider credentials out of the WhatsApp publisher process.

Provider requirements fail closed before gcloud runs:

- `DEAL_DATA_PROVIDER=rainforest` requires `RAINFOREST_API_KEY` in `GCP_WEB_SECRETS`.
- `DEAL_DATA_PROVIDER=amazon_paapi` requires `AMAZON_PAAPI_ACCESS_KEY`, `AMAZON_PAAPI_SECRET_KEY`, and `AMAZON_PAAPI_PARTNER_TAG`.
- `DEAL_DATA_PROVIDER=auto` requires either Rainforest or the complete PA-API credential set.

Additional web-only secrets such as SMTP credentials or an admin bootstrap password may be appended to `GCP_WEB_SECRETS`.

## Inspect before changing production

Render the exact gcloud commands without executing them:

```bash
npm run release:gcp -- --dry-run
```

The dry run prints Secret Manager references but never resolves or prints their secret contents. Review the project, region, immutable image, service names, Cloud SQL attachment, public origin, CORS origins, and worker session before proceeding.

## Deploy

After the dry run is correct:

```bash
npm run release:gcp
```

The release script performs two ordered deployments:

1. `gcloud run deploy` for the public website/API service, with Cloud SQL attached.
2. `gcloud run worker-pools deploy` for a single Status publisher instance, overriding the image command to `node publication-worker.js`.

The publisher is deliberately pinned by the release script to:

```text
PUBLICATION_CHANNEL=whatsapp_status
PUBLICATION_TRANSPORT=waha
PUBLICATION_RUN_MODE=continuous
```

The worker receives only the Cloud SQL connection name, publication controls, WAHA base URL/session, DB secrets, and WAHA API key. Deal selection, verification, lifecycle truth, cadence, and publication history remain in the shared backend/database.

## First WhatsApp Status rollout

Do not make the continuous worker pool the first call ever made to a newly paired WAHA account. Before the production worker is enabled:

1. Pair the intended WhatsApp account/session with WAHA.
2. Run a controlled `PUBLICATION_RUN_MODE=once` publisher against the real database and real WAHA transport.
3. Confirm exactly one known eligible Status appears and its external publication identity is persisted.
4. Immediately run another bounded cycle and verify cadence prevents an immediate second Status.
5. Only then deploy/enable the continuous worker pool.

WAHA is an unofficial WhatsApp Web automation layer. Treat account/session health and WhatsApp enforcement behavior as an external operational risk even when DealScout's queue and transport code are healthy.

## Post-deploy verification

After the web revision is live, run the read-only release smoke against its public origin:

```bash
npm run smoke:release -- https://your-api-origin.example
```

Verify `/api/ready` is healthy before shifting traffic. Then confirm the admin operations view can see publication health and that the Status worker is claiming/publishing only eligible jobs at the expected cadence.

The native app continues to use the same API. Its production EAS build should point `EXPO_PUBLIC_API_URL` at the verified HTTPS web/API origin only after this web release passes smoke checks.
