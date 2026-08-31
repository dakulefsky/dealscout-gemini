# WAHA WhatsApp Status transport

DealScout can deliver its prepared `whatsapp_status` publication jobs directly to a self-hosted WAHA instance. WAHA is a transport only: DealScout continues to own deal verification, eligibility, ranking, caption facts, cadence, deduplication, queue leases, retries and publication history.

## Important support boundary

WAHA automates WhatsApp Web and is not Meta's official WhatsApp Business Platform. Treat account/session stability and WhatsApp enforcement as an external operational risk. The adapter is deliberately isolated so WAHA can be replaced later without changing DealScout's deal truth or publishing policy.

## WAHA setup

1. Run WAHA on infrastructure you control and persist its session data across restarts.
2. Set a strong WAHA API key and keep the dashboard/Swagger endpoints private or separately protected.
3. Create/pair the WhatsApp session by scanning the WAHA QR code and confirm the session reaches `WORKING` before enabling DealScout publishing.
4. Prefer a private network path between DealScout and WAHA. The DealScout production worker requires an HTTPS `WAHA_BASE_URL`; terminate TLS at WAHA or a private reverse proxy.
5. Do not put `WAHA_API_KEY` in the repository, image, logs or browser/mobile configuration. Load it from the deployment secret store.

DealScout worker configuration:

```text
PUBLICATION_CHANNEL=whatsapp_status
PUBLICATION_TRANSPORT=waha
WAHA_BASE_URL=https://waha.internal.example
WAHA_API_KEY=<secret>
WAHA_SESSION=dealscout-status
WAHA_TIMEOUT_MS=20000

PUBLICATION_POLL_MS=1800000
PUBLICATION_MIN_SPACING_SECONDS=1800
PUBLICATION_MAX_PER_CYCLE=1
```

`WAHA_SESSION` is explicit so a deployment cannot silently publish from the wrong paired WhatsApp account.

## API contract

For each leased, revalidated Status job, DealScout sends the already-composed image/caption to:

```text
POST /api/{session}/status/image
X-Api-Key: <WAHA_API_KEY>
Content-Type: application/json
Accept: application/json
```

Body:

```json
{
  "file": {
    "mimetype": "image/jpeg",
    "url": "https://...verified-stored-image..."
  },
  "caption": "...DealScout factual Status caption..."
}
```

The adapter records WAHA's returned `key.id` as the publication job's external publication identity. A successful HTTP response without a message ID is treated as a failed transport result rather than silently marking the job published.

The adapter never receives authority to change deal price, verification, eligibility or copy. It also refuses channels other than `whatsapp_status`.

## Failure behavior

WAHA media/status calls can be slower or less stable than ordinary text requests depending on engine/session/network conditions. `WAHA_TIMEOUT_MS` bounds every Status call. Timeout, HTTP failure or malformed success response flows through DealScout's existing durable retry/backoff state; it does not alter deal lifecycle truth.

Do not increase `WAHA_TIMEOUT_MS` indefinitely to hide a stuck WAHA engine. Investigate WAHA session state, media reachability and engine health instead.

DealScout's 30-minute Status spacing and PostgreSQL advisory lock remain authoritative above WAHA. Restarting WAHA or the publication worker does not reset cadence, and running multiple DealScout workers cannot intentionally publish multiple Status posts in parallel.

## Controlled rollout

Before continuous production publishing:

1. Pair the intended WAHA session and confirm it is `WORKING`.
2. Verify the DealScout production/staging worker points at the intended WAHA base URL and session.
3. Use a real eligible verified DealScout deal with a reachable image URL.
4. Run `PUBLICATION_RUN_MODE=once npm run publisher`.
5. Confirm exactly one Status appears on the intended WhatsApp account with the prepared DealScout caption/image.
6. Confirm the publication job is `published` and stores the WAHA `key.id` as external identity.
7. Run another cycle immediately and confirm DealScout reports cadence deferral rather than posting again.
8. Only then enable continuous/scheduled execution.

If Status posting becomes unreliable, disable the publication worker or switch `PUBLICATION_TRANSPORT` back to another supported adapter. Do not bypass DealScout's queue by adding an independent WAHA cron that posts deals directly.

## WAHA engine notes

Current WAHA documentation lists image Status support across WEBJS, WPP, NOWEB and GOWS. Engine-specific behavior can still differ, especially for large contact sets and media handling. Start with one paired account and default all-contact Status behavior; add contact targeting only as a separate, tested product requirement.
