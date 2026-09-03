# PostgreSQL migration notes

DealScout migrated production persistence away from direct JSON/in-memory storage in staged slices so each production data boundary could move independently.

## Current state

Production deal, user, bookmark, price-alert, publication, maintenance-cadence, and provider-usage data is repository-backed in PostgreSQL. The JSON database remains a development fallback only and must not act as a hidden secondary production datastore.

Verified price observations are now **alert-only**: a successful provider price check can evaluate active price alerts, but DealScout no longer stores or exposes shopper-facing observed price history. The former `price_history` storage path and public history endpoint are retired.

## Remaining cleanup rule

Legacy JSON compatibility code should only remain while an active repository caller still depends on it. Dead compatibility shims should be removed rather than preserved as misleading architecture documentation.

Production schema changes should remain independently deployable and reversible, with indexes and constraints added alongside the repository behavior that depends on them.
