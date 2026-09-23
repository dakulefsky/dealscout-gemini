# DealScout technical backlog

These are intentional follow-up items, not forgotten cleanup.

## Architecture
- **Test layout:** reorganize the large `tests/` root into purpose-based folders (unit, contracts, security, integration, UI) and then shard CI by stable groups. Do this after the current shopper/design stabilization so file moves do not obscure product work.
- **Shared core package:** replace mobile imports that reach into `src/lib/` with a small internal `packages/core/` workspace for platform-neutral domain code such as ranking and personalization. Keep platform storage/UI adapters outside the package.
- **Cloud SQL pool budgets — implemented:** the release plan assigns explicit per-role caps (web 4, admin 3, publisher 2 by default) while keeping the underlying process-local pools isolated. Revisit the numbers only when production concurrency data justifies it.

## Product reliability
- **Product-detail recovery — implemented on web and mobile:** avoid deployment-sensitive web lazy chunks, retry one transient GET in the shared client, and provide an in-page retry before asking for a full reload.
