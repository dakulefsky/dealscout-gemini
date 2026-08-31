# DealScout API v1

`/api/v1` is the compatibility contract for DealScout website and mobile clients. New shopper-facing clients should use this prefix rather than unversioned `/api` resource paths.

The current v1 resources are:

- `/api/v1/auth`
- `/api/v1/deals`
- `/api/v1/deals/feed`
- `/api/v1/categories`
- `/api/v1/bookmarks`
- `/api/v1/meta`

All v1 responses include `X-DealScout-API-Version: 1`, including errors generated before a resource route runs, such as global rate limiting. `GET /api/v1/meta` returns the active major version.

All API responses include `X-Request-ID`. Surface this identifier in client diagnostics/support reports so server logs can be correlated without exposing internal implementation details.

## Shared client boundary

`src/lib/apiCore.js` is the platform-neutral JavaScript client for the v1 contract. It owns request/error handling and the resource methods, but it does not own browser storage, `window`, or Vite environment state. Token and guest-identity providers may return values synchronously or asynchronously, so native clients can use secure/async storage without forking API behavior.

`src/lib/api.js` is the website adapter. It supplies the website API base URL plus `localStorage` token/guest identity. A native client should instantiate `createDealScoutClient` with its own API base URL, fetch implementation when needed, secure token reader, and persisted guest-identity reader. Private admin operations remain available to the website adapter but are outside the supported mobile v1 compatibility surface.

## Error contract

Existing human-readable `error` messages are preserved. v1 error responses add a stable machine category and request identifier:

```json
{
  "error": "Too many requests. Please try again later.",
  "code": "RATE_LIMITED",
  "requestId": "<request-id>"
}
```

Clients should branch on HTTP status and `code`, not on the English `error` text. The message may improve over time without being a breaking API change. Current broad categories include `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, and `SERVICE_UNAVAILABLE`; unknown 4xx/5xx statuses fall back to `REQUEST_FAILED` or `SERVER_ERROR`.

Successful response bodies are not wrapped or otherwise changed by the tracing/error middleware.

The old unversioned auth/deal/category/bookmark paths remain mounted as compatibility aliases to the same route implementation. They should not receive new client integrations. They receive request IDs for operations/debugging, but their historical error-body shape remains unchanged.

Admin automation endpoints such as `/api/functions`, `/api/editorial`, and `/api/ai` are intentionally outside the mobile compatibility contract. They are private operational surfaces and may evolve with the admin application.

## Compatibility policy

Within v1, additive response fields are allowed. Existing field meanings, visibility rules, cursor semantics, and required request fields should not be changed incompatibly. A change that requires existing mobile clients to update must use a new major API prefix rather than silently changing v1.

Deal truth remains server-owned. Mobile/web clients must not infer that an unverified, expired, or stale deal is publishable merely from cached data. The backend visibility and distribution policies remain authoritative.
