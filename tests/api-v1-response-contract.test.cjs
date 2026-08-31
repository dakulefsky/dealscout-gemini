const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { apiResponseContract, errorCodeForStatus } = require('../server/middleware/apiResponseContract');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function fakeResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    locals: {},
    body: undefined,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    json(payload) { this.body = payload; return this; },
  };
}

test('v1 errors have stable machine codes', () => {
  assert.equal(errorCodeForStatus(400), 'BAD_REQUEST');
  assert.equal(errorCodeForStatus(401), 'UNAUTHORIZED');
  assert.equal(errorCodeForStatus(403), 'FORBIDDEN');
  assert.equal(errorCodeForStatus(404), 'NOT_FOUND');
  assert.equal(errorCodeForStatus(409), 'CONFLICT');
  assert.equal(errorCodeForStatus(429), 'RATE_LIMITED');
  assert.equal(errorCodeForStatus(503), 'SERVICE_UNAVAILABLE');
  assert.equal(errorCodeForStatus(418), 'REQUEST_FAILED');
  assert.equal(errorCodeForStatus(502), 'SERVER_ERROR');
});

test('v1 response contract adds API version and request tracing before error responses', () => {
  const req = { path: '/api/v1/deals/feed' };
  const res = fakeResponse();
  let nextCalled = false;
  apiResponseContract(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(res.getHeader('x-dealscout-api-version'), '1');
  const requestId = res.getHeader('x-request-id');
  assert.match(requestId, /^[0-9a-f-]{36}$/i);

  res.statusCode = 429;
  res.json({ error: 'Too many requests. Please try again later.' });
  assert.deepEqual(res.body, {
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
    requestId,
  });
});

test('v1 success bodies remain unchanged', () => {
  const res = fakeResponse();
  apiResponseContract({ path: '/api/v1/meta' }, res, () => {});
  const payload = { apiVersion: '1' };
  res.json(payload);
  assert.deepEqual(res.body, payload);
});

test('legacy API keeps its existing error body while still receiving request tracing', () => {
  const res = fakeResponse();
  apiResponseContract({ path: '/api/deals' }, res, () => {});
  const requestId = res.getHeader('x-request-id');
  assert.match(requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(res.getHeader('x-dealscout-api-version'), undefined);

  res.statusCode = 503;
  res.json({ error: 'Deals are temporarily unavailable' });
  assert.deepEqual(res.body, { error: 'Deals are temporarily unavailable' });
});

test('non-API requests are untouched', () => {
  const res = fakeResponse();
  apiResponseContract({ path: '/deal/B000000001' }, res, () => {});
  assert.equal(res.getHeader('x-request-id'), undefined);
});

test('v1 response contract is installed before the global API rate limiter', () => {
  const contractPosition = serverSource.indexOf("apiResponseContract.js').apiResponseContract");
  const limiterPosition = serverSource.indexOf('app.use(apiRateLimit());');
  assert.ok(contractPosition >= 0);
  assert.ok(limiterPosition > contractPosition);
});
