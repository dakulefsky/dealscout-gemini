# DealScout product surfaces

DealScout is one deal product with multiple surfaces, not three independently designed products.

## Website

The website is the full shopper experience and the operational admin surface. Shoppers browse the verified cursor feed, search, open deal detail, save deals and continue to Amazon. Admin and provider operations remain web-only.

## Mobile app

The mobile app mirrors the shopper website: the same verified deal inventory, cursor API, deal facts, save identity and destination URLs. Native code owns only platform concerns such as navigation, secure local identity storage and external-link handling. It must not fork ranking, verification, lifecycle or deal-truth rules from the backend.

## WhatsApp Status

WhatsApp Status is the primary automated WhatsApp surface. DealScout selects a stricter subset of freshly verified, image-backed deals, queues publication idempotently and hands already-composed factual content to the configured transport adapter.

A chat or message feed may be added later, but it is secondary and must consume the same publication/deal domain. It should not become a separate source of deal truth.

## Shared rule

The architectural question for every feature is: **does this remain one DealScout experience when the same deal appears on the website, in the app and on WhatsApp Status?**

Provider facts, verification, lifecycle, eligibility and canonical ASIN identity live below every surface. Presentation can differ for screen size or transport constraints; commercial facts cannot.
