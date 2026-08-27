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
