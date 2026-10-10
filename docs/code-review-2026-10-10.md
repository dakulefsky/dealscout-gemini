# DealScout code review — 10 October 2026

Scope: production startup and database access, automated discovery and refresh, visibility and categories, publication workers, authentication, shopper requests, affiliate links, SEO and release configuration. Review started at approximately 20:52 UTC. This is a code and release review; it is not an independent audit of AWS billing, backup contents or live IAM policies.

## Fixed and covered by regression checks

- Preserve rejected products through rediscovery, provider bulk refresh and expired-row cleanup. Explicit rejection clears old expiry flags.
- Preserve exact PostgreSQL decimal scores in pagination cursors to avoid skipped or repeated rows.
- Return readable, uncached HTML on SEO rendering failure, with 503/Retry-After for temporary failures and 400 for malformed links. Do not leak database errors or present stale offers.
- Send the initial server-rendered Amazon button through the existing affiliate redirect, matching the hydrated shopper button.
- Permit public HEAD requests for catalog resources without permitting writes.
- Keep browsing functional when browser storage is blocked or full, with a stable guest identity per page. Explain blocked storage when signing in requires persistence.
- Return 503 for authenticated database outages rather than falsely invalidating a valid session.
- Compare and consume password-reset tokens atomically, and revoke earlier account tokens only once.
- Share settings schema initialization between requests and retry failed initialization; continue reading current policy values from the database.
- Discard pooled connections when transaction rollback fails, preserving the original operation error.
- Record verification success only after the deal update succeeds.
- Fence publication completion/failure/cancellation by lease attempt so a delayed worker cannot mutate a newer worker's job.
- Remove completed publication sleep abort listeners to avoid an accumulating listener leak.
- Preserve HTTP 400/413 parser status, avoid logging submitted credentials, and forward errors after headers have been sent.

## Validation

Local full test suite, lint and production frontend build are run before publication. CI also validates the container build. Failure-path tests use isolated fakes or local HTTP servers; the review does not consume Rainforest requests or send publications/emails. Monthly provider capacity remains 500, with the existing ordinary and Prime Day daily limits unchanged. Public/private service isolation and bounded instance configuration remain intact.

## Follow-up issues requiring a focused change

1. Deal updates still merge a full previously read record into an upsert. Concurrent administrative edits and automated refreshes can overwrite each other. Introduce conditional or field-scoped updates with real PostgreSQL concurrency tests, particularly for manual rejection.
2. Bookmark toggle/target writes use read-then-write operations. Concurrent tabs can encounter uniqueness conflicts. Serialize toggles and use atomic target upserts with database tests.
3. Canonical category bootstrap can overwrite administrator changes; renaming a category does not migrate stored deal labels. Define category identity and a migration before changing this behavior.
4. Verification-code consumption is not yet atomic against resend. Apply a compare-and-consume operation similar to password resets.
5. Bcrypt truncates inputs after 72 bytes while current password validation permits longer values. Any correction must preserve existing-account compatibility and establish a password migration policy.
6. Optional identity paths can fall back to guest behavior during account lookup outages. Distinguish invalid credentials from temporary lookup failures consistently across saved deals and notifications.
7. Publication database fencing does not make external delivery exactly once after an unknown transport outcome. Adapter idempotency requires provider support or reconciliation.
8. Stored short Amazon URLs and publication content require a separate affiliate canonicalization audit. Adding a tag to a short URL cannot prove the resolved destination retains that tag.

Live infrastructure follow-up: independently verify RDS backups/restoration, runtime connection capacity and source-IP rules, current costs, IAM scope, and live Search Console crawl results when account access is available. Successful release checks establish current serving behavior; they do not establish all of these properties.
