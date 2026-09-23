# DealScout technical backlog

These are intentional follow-up items, not forgotten cleanup.

## Architecture
- **Test layout:** reorganize the large `tests/` root into purpose-based folders (unit, contracts, security, integration, UI) and then shard CI by stable groups. Do this after the current shopper/design stabilization so file moves do not obscure product work.
- **Shared core package:** replace mobile imports that reach into `src/lib/` with a small internal `packages/core/` workspace for platform-neutral domain code such as ranking and personalization. Keep platform storage/UI adapters outside the package.
- **Cloud SQL pool budgets:** keep web/API and publication-worker pools isolated by runtime role and set explicit per-role pool caps so Cloud Run scale-out cannot multiply the default connection budget unexpectedly.

## Product reliability
- Treat product-detail navigation and deal retrieval as critical commerce paths: avoid deployment-sensitive lazy chunks for the product page, retry one transient read failure, and provide an in-page retry before asking for a full reload.
