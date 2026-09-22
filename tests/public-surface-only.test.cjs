const test = require('node:test');
const assert = require('node:assert/strict');
const { publicSurfaceOnly } = require('../server/middleware/publicSurfaceOnly');

function run(path, method = 'GET') {
  const previous = process.env.PUBLIC_SURFACE_ONLY;
  process.env.PUBLIC_SURFACE_ONLY = 'true';
  let statusCode = 200;
  let nextCalled = false;
  const req = { path, method };
  const res = {
    status(code) { statusCode = code; return this; },
    type() { return this; },
    send(body) { return { statusCode, body }; },
    json(body) { return { statusCode, body }; },
  };
  const result = publicSurfaceOnly(req, res, () => { nextCalled = true; });
  if (previous === undefined) delete process.env.PUBLIC_SURFACE_ONLY;
  else process.env.PUBLIC_SURFACE_ONLY = previous;
  return { statusCode, nextCalled, result };
}

test('public shopper service hides private admin surfaces', () => {
  assert.equal(run('/admin').statusCode, 404);
  assert.equal(run('/api/v1/auth/login', 'POST').statusCode, 404);
  assert.equal(run('/api/functions/provider-status').statusCode, 404);
});

test('public shopper service keeps shopper reads, guest features, and affiliate redirect available', () => {
  assert.equal(run('/api/v1/deals/feed').nextCalled, true);
  assert.equal(run('/api/v1/categories').nextCalled, true);
  assert.equal(run('/api/v1/bookmarks/toggle', 'POST').nextCalled, true);
  assert.equal(run('/api/functions/amazon-redirect', 'POST').nextCalled, true);
});

test('public shopper service blocks admin catalog mutations', () => {
  assert.equal(run('/api/v1/deals/abc', 'PATCH').statusCode, 404);
  assert.equal(run('/api/v1/categories/cat-electronics', 'PATCH').statusCode, 404);
  assert.equal(run('/api/editorial/B000000001', 'PUT').statusCode, 404);
});


test('public shopper service still blocks every other operational function endpoint', () => {
  assert.equal(run('/api/functions/provider-status').statusCode, 404);
  assert.equal(run('/api/functions/fetch-deals', 'POST').statusCode, 404);
  assert.equal(run('/api/functions/verify-prices', 'POST').statusCode, 404);
  assert.equal(run('/api/ai/ask-deal-assistant', 'POST').statusCode, 404);
  assert.equal(run('/api/ai/analyze-deal', 'POST').statusCode, 404);
});
