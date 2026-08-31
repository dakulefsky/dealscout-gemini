const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadSmoke() {
  return import(`${pathToFileURL(path.join(__dirname, '..', 'scripts', 'release-smoke.mjs')).href}?test=${Date.now()}-${Math.random()}`);
}

function jsonResponse(body, { status = 200, v1 = false, requestId = 'req-1' } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (v1) headers.set('x-dealscout-api-version', '1');
  if (requestId) headers.set('x-request-id', requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

test('release smoke accepts HTTPS deployments and localhost HTTP only', async () => {
  const { cleanBaseUrl } = await loadSmoke();
  assert.equal(cleanBaseUrl('https://deals.example.com/'), 'https://deals.example.com');
  assert.equal(cleanBaseUrl('http://localhost:8080/'), 'http://localhost:8080');
  assert.throws(() => cleanBaseUrl('http://deals.example.com'), /HTTPS/);
  assert.throws(() => cleanBaseUrl('not-a-url'), /absolute URL/);
});

test('release smoke validates read-only web, readiness and v1 shopper contracts', async () => {
  const { runReleaseSmoke } = await loadSmoke();
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), method: options.method });
    const pathname = new URL(url).pathname;
    if (pathname === '/api/health') return jsonResponse({ status: 'ok' });
    if (pathname === '/api/ready') return jsonResponse({ status: 'ready' });
    if (pathname === '/api/v1/meta') return jsonResponse({ apiVersion: '1' }, { v1: true });
    if (pathname === '/api/v1/deals/feed') return jsonResponse({ items: [{ id: 'B000000001', asin: 'B000000001' }], nextCursor: null }, { v1: true });
    if (pathname === '/api/v1/deals/B000000001') return jsonResponse({ id: 'B000000001', asin: 'B000000001' }, { v1: true });
    return jsonResponse({ error: 'unexpected path' }, { status: 404, v1: pathname.startsWith('/api/v1/') });
  };

  const result = await runReleaseSmoke('https://deals.example.com', { fetchImpl, timeoutMs: 1000 });
  assert.deepEqual(result.checks, ['liveness', 'readiness', 'v1-meta', 'v1-feed', 'v1-deal-detail']);
  assert.equal(result.inventoryObserved, true);
  assert.equal(requests.every((request) => request.method === 'GET'), true);
  assert.equal(requests.some((request) => request.url.includes('/api/functions/')), false);
});

test('release smoke permits an empty public catalog but still validates the feed contract', async () => {
  const { runReleaseSmoke } = await loadSmoke();
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/api/health') return jsonResponse({ status: 'ok' });
    if (pathname === '/api/ready') return jsonResponse({ status: 'ready' });
    if (pathname === '/api/v1/meta') return jsonResponse({ apiVersion: '1' }, { v1: true });
    if (pathname === '/api/v1/deals/feed') return jsonResponse({ items: [], nextCursor: null }, { v1: true });
    throw new Error(`unexpected ${pathname}`);
  };

  const result = await runReleaseSmoke('https://deals.example.com', { fetchImpl, timeoutMs: 1000 });
  assert.equal(result.inventoryObserved, false);
  assert.deepEqual(result.checks, ['liveness', 'readiness', 'v1-meta', 'v1-feed']);
});

test('release smoke fails closed on readiness or v1 tracing regressions', async () => {
  const { runReleaseSmoke } = await loadSmoke();
  const notReady = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/api/health') return jsonResponse({ status: 'ok' });
    if (pathname === '/api/ready') return jsonResponse({ status: 'starting' }, { status: 200 });
    throw new Error('should not continue after readiness failure');
  };
  await assert.rejects(() => runReleaseSmoke('https://deals.example.com', { fetchImpl: notReady, timeoutMs: 1000 }), /status=ready/);

  const missingVersion = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/api/health') return jsonResponse({ status: 'ok' });
    if (pathname === '/api/ready') return jsonResponse({ status: 'ready' });
    if (pathname === '/api/v1/meta') return jsonResponse({ apiVersion: '1' }, { requestId: 'req-2' });
    throw new Error('should not continue after v1 header failure');
  };
  await assert.rejects(() => runReleaseSmoke('https://deals.example.com', { fetchImpl: missingVersion, timeoutMs: 1000 }), /X-DealScout-API-Version/);
});
