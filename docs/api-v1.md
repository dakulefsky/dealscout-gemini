# DealScout API v1

`/api/v1` is the compatibility contract for DealScout website and mobile clients. New shopper-facing clients should use this prefix rather than unversioned `/api` resource paths.

The current v1 resources are:

- `/api/v1/auth`
- `/api/v1/deals`
- `/api/v1/deals/feed`
- `/api/v1/categories`
- `/api/v1/bookmarks`
- `/api/v1/meta`

Successful v1 responses include `X-DealScout-API-Version: 1`. `GET /api/v1/meta` returns the active major version.

The old unversioned auth/deal/category/bookmark paths remain mounted as compatibility aliases to the same route implementation. They should not receive new client integrations.

Admin automation endpoints such as `/api/functions`, `/api/editorial`, and `/api/ai` are intentionally outside the mobile compatibility contract. They are private operational surfaces and may evolve with the admin application.

## Compatibility policy

Within v1, additive response fields are allowed. Existing field meanings, visibility rules, cursor semantics, and required request fields should not be changed incompatibly. A change that requires existing mobile clients to update must use a new major API prefix rather than silently changing v1.

Deal truth remains server-owned. Mobile/web clients must not infer that an unverified, expired, or stale deal is publishable merely from cached data. The backend visibility and distribution policies remain authoritative.
