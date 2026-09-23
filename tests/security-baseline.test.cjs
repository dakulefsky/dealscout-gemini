const test = require('node:test');
const assert = require('node:assert/strict');

const { securityHeaders, apiRateLimit } = require('../server/middleware/securityBaseline');

function responseMock() {
  const headers = {};
  return {
    statusCode: 200,
    body: null,
    headers,
    setHeader(name, value) { headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('securityHeaders adds baseline browser protections', () => {
  const res = responseMock();
  let nextCalled = false;
  securityHeaders({}, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.equal(res.headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
});

test('apiRateLimit ignores non-API requests', () => {
  const limiter = apiRateLimit({ max: 1, windowMs: 60000 });
  const res = responseMock();
  let nextCalled = false;
  limiter({ path: '/', ip: 'test-non-api' }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('apiRateLimit blocks requests above the configured limit', () => {
  const limiter = apiRateLimit({ max: 2, windowMs: 60000 });
  const req = { path: '/api/deals', ip: 'test-rate-limit' };
  const first = responseMock();
  const second = responseMock();
  const third = responseMock();
  limiter(req, first, () => {});
  limiter(req, second, () => {});
  limiter(req, third, () => {});
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
  assert.match(third.body.error, /Too many requests/);
});


test('apiRateLimit separates shoppers behind the same proxy by guest identity', () => {
  const limiter = apiRateLimit({ max: 1, windowMs: 60000 });
  const sharedIp = 'proxy-hop';
  const shopperA = { path: '/api/v1/deals/feed', ip: sharedIp, headers: { 'x-guest-id': 'guest_aaaaaaaaa' } };
  const shopperB = { path: '/api/v1/deals/feed', ip: sharedIp, headers: { 'x-guest-id': 'guest_bbbbbbbbb' } };

  const a1 = responseMock();
  const a2 = responseMock();
  const b1 = responseMock();

  limiter(shopperA, a1, () => {});
  limiter(shopperA, a2, () => {});
  limiter(shopperB, b1, () => {});

  assert.equal(a1.statusCode, 200);
  assert.equal(a2.statusCode, 429);
  assert.equal(b1.statusCode, 200);
  assert.ok(Number(a2.headers['Retry-After']) >= 1);
});

test('apiRateLimit ignores invalid guest ids and falls back to the network identity', () => {
  const limiter = apiRateLimit({ max: 1, windowMs: 60000 });
  const first = responseMock();
  const second = responseMock();
  limiter({ path: '/api/v1/deals/feed', ip: 'same-ip', headers: { 'x-guest-id': 'spoof' } }, first, () => {});
  limiter({ path: '/api/v1/deals/feed', ip: 'same-ip', headers: { 'x-guest-id': 'different-spoof' } }, second, () => {});
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 429);
});
