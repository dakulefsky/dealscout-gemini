# DealScout distribution architecture

DealScout is one automated deal-intelligence system with multiple delivery surfaces. The verified deal catalog is the source of truth; the website, mobile app, and WhatsApp Status are consumers of channel-specific publishing decisions.

## Pipeline

`provider ingestion -> verification -> quality/lifecycle -> distribution eligibility -> channel selection -> publishing queue -> factual content composition -> channel adapter`

Provider and verification code must never post directly to a distribution channel. Distribution must never invent product facts. Every channel consumes already-verified deal records and may only apply stricter selection/cadence rules.

## Channel policy

`server/services/distributionPolicy.js` owns deterministic eligibility and selection rules.

- `web`: approved, verified, active, >=15% discount, successful price check within 7 days.
- `app`: same catalog truth boundary as web. Personalization is a presentation/ranking concern layered after catalog eligibility.
- `whatsapp_status`: stricter broadcast surface: approved, verified, active, >=20% discount, quality score >=75, valid image, successful price check within 24 hours.

The stricter WhatsApp policy prevents an unattended broadcaster from amplifying weak or stale inventory merely because it exists in the catalog.

## Publishing queue

`server/repositories/publicationQueueRepository.js` and `server/services/publicationService.js` own durable publication jobs rather than calling external APIs synchronously from ingestion. Jobs record channel, ASIN, verification snapshot, policy decision, scheduling, lease/retry state, attempt count, external publication identity, and publication timestamps.

Queue insertion is idempotent for the channel + ASIN + verification snapshot. Workers lease jobs atomically, reclaim expired leases after crashes, use bounded retries, and re-evaluate deal eligibility immediately before publication so expired, stale, or superseded deals are cancelled instead of posted.

## Factual content composition

`server/services/publicationContentService.js` is the single copy/facts boundary between live deal truth and transports. It receives the revalidated deal and produces normalized publication content from stored facts only: ASIN, title, category, observed prices, discount, savings, product image, destination URL, and successful price-check time.

WhatsApp Status receives concise image-caption copy with the observed price comparison and an explicit warning that Amazon pricing can change. App and web receive structured deal-card content. The composer fails closed if the deal is no longer eligible for the requested channel.

This layer must not use generative text to invent urgency, popularity, quality claims, stock claims, reviews, or product facts. If AI-assisted copy is added later, it must remain downstream of factual composition and be constrained to wording that cannot alter the underlying claims.

## Channel adapters

`server/services/publicationWorker.js` passes adapters `{ channel, job, deal, content }` only after the queue service has revalidated the live deal and the content service has composed eligible factual content.

Channel-specific transport belongs behind adapters such as `website`, `mobile_push`, or `whatsapp_status`. An adapter may translate the prepared content into a provider API payload, but it must not decide product quality, alter verified price facts, change eligibility, or reach back into provider ingestion.

This boundary allows the website, mobile app, and WhatsApp automation to evolve independently while preserving one catalog, one copy truth boundary, and one trust model.
