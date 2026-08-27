# PostgreSQL migration plan

DealScout is migrating away from direct JSON/in-memory persistence in staged slices so production data is not put at risk by a single large rewrite.

## Phase 1 — observed price history

Price history is the first relational domain. When `DATABASE_URL` is configured, verified price observations are written to PostgreSQL in the `price_history` table. Without `DATABASE_URL`, local development uses an atomic JSON fallback at `server/data/price-history.json`.

The public price-history endpoint now returns only real observations collected from verified providers. The previous simulated 30-day curve is no longer served.

## Next phases

1. Categories and users move behind repository interfaces.
2. Deals move to PostgreSQL with explicit transactional writes and indexes on ASIN, status, source verification, and timestamps.
3. Bookmarks and price alerts move after users/deals so foreign keys can be enforced.
4. The legacy `db.tables` and SQL-compatibility shim are removed only after all callers use repositories.

This staged approach keeps each migration independently deployable and reversible while preserving data integrity.
