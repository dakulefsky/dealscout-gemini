# DealScout distribution architecture

DealScout is one automated deal-intelligence system with multiple delivery surfaces. The verified deal catalog is the source of truth; the website, mobile app, and WhatsApp Status are consumers of channel-specific publishing decisions.

## Pipeline

`provider ingestion -> verification -> quality/lifecycle -> distribution eligibility -> channel selection -> publishing queue -> channel adapter`

Provider and verification code must never post directly to a distribution channel. Distribution must never invent product facts. Every channel consumes already-verified deal records and may only apply stricter selection/cadence rules.

## Channel policy

`server/services/distributionPolicy.js` owns deterministic eligibility and selection rules.

- `web`: approved, verified, active, >=15% discount, successful price check within 7 days.
- `app`: same catalog truth boundary as web. Personalization is a presentation/ranking concern layered after catalog eligibility.
- `whatsapp_status`: stricter broadcast surface: approved, verified, active, >=20% discount, quality score >=75, valid image, successful price check within 24 hours.

The stricter WhatsApp policy prevents an unattended broadcaster from amplifying weak or stale inventory merely because it exists in the catalog.

## Next layer: publishing queue

A later persistence layer should create immutable publication jobs rather than calling external APIs synchronously from ingestion. Each job should include at minimum:

- channel
- ASIN / deal ID
- source verification timestamp used for the decision
- distribution score and policy version
- scheduled time
- state (`queued`, `leased`, `published`, `failed`, `cancelled`)
- attempt count / retry-after
- external publication ID when available
- published timestamp

Queue insertion should be idempotent with a uniqueness window so the same ASIN cannot be repeatedly posted to the same channel. Workers should lease jobs atomically, use bounded retries, and re-evaluate deal eligibility immediately before publication so expired or stale deals are cancelled instead of posted.

## Channel adapters

Channel-specific transport belongs behind adapters such as `website`, `mobile_push`, or `whatsapp_status`. An adapter receives a publication job and prepared factual content; it must not decide product quality, alter verified price facts, or reach back into provider ingestion.

This boundary allows the website, mobile app, and WhatsApp automation to evolve independently while preserving one catalog and one trust model.
