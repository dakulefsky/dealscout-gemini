const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const coreSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'apiCore.js'), 'utf8');
const webSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');

async function loadCore() {
  return import(`${pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'apiCore.js')).href}?test=${Date.now()}`);
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  const normalized = new Map(Object.entries({ 'content-type': 'application/json', ...headers }).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => normalized.get(String(name).toLowerCase()) || null },
    json: async () => body,
  };
}

test('portable API core contains no browser storage, window or Vite environment coupling', () => {
  assert.doesNotMatch(coreSource, /localStorage/);
  assert.doesNotMatch(coreSource, /\bwindow\b/);
  assert.doesNotMatch(coreSource, /import\.meta\.env/);
  assert.match(webSource, /localStorage/);
  assert.match(webSource, /import\.meta\.env\.VITE_API_URL/);
  assert.match(webSource, /createDealScoutClient/);
});

test('portable client accepts async native-style identity providers and uses v1 routes', async () => {
  const { createDealScoutClient } = await loadCore();
  let request;
  const client = createDealScoutClient({
    baseUrl: 'https://api.example.com/',
    getToken: async () => 'mobile-token',
    getGuestId: async () => 'guest_mobile-123',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ items: [], nextCursor: null });
    },
  });

  const result = await client.deals.page({ minDiscount: 20, limit: 25 });
  assert.deepEqual(result, { items: [], nextCursor: null });
  assert.equal(request.url, 'https://api.example.com/api/v1/deals/feed?minDiscount=20&limit=25');
  assert.equal(request.options.headers.Authorization, 'Bearer mobile-token');
  assert.equal(request.options.headers['x-guest-id'], 'guest_mobile-123');
});

test('portable client carries stable v1 error code and request id onto thrown errors', async () => {
  const { createDealScoutClient } = await loadCore();
  const client = createDealScoutClient({
    fetchImpl: async () => jsonResponse({
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMITED',
      requestId: 'req-123',
    }, { status: 429, headers: { 'x-request-id': 'req-123' } }),
  });

  await assert.rejects(client.deals.page(), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.code, 'RATE_LIMITED');
    assert.equal(error.requestId, 'req-123');
    return true;
  });
});

test('portable client encodes resource identifiers before placing them in paths', async () => {
  const { createDealScoutClient } = await loadCore();
  let url;
  const client = createDealScoutClient({
    fetchImpl: async (value) => {
      url = value;
      return jsonResponse({ id: 'ok' });
    },
  });
  await client.deals.get('abc/def');
  assert.equal(url, '/api/v1/deals/abc%2Fdef');
});

test('timeout handling uses injected/global timers rather than window timers', async () => {
  const { createDealScoutClient } = await loadCore();
  let timerScheduled = false;
  const client = createDealScoutClient({
    defaultTimeoutMs: 10,
    timers: {
      AbortControllerImpl: globalThis.AbortController,
      setTimeoutImpl(fn) { timerScheduled = true; fn(); return 1; },
      clearTimeoutImpl() {},
    },
    fetchImpl: async (_url, options) => {
      if (options.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      return jsonResponse({ ok: true });
    },
  });

  await assert.rejects(client.api.get('/api/v1/meta'), (error) => {
    assert.equal(error.name, 'TimeoutError');
    assert.equal(error.code, 'REQUEST_TIMEOUT');
    return true;
  });
  assert.equal(timerScheduled, true);
});
