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

function publicStatic(pathname, base) {
  if (pathname === '/') return new Response(
    `<html><head><meta name="robots" content="index,follow" /><link rel="canonical" href="${base}/" /></head><body><main data-server-crawl-content="home">ca-pub-7492088381598802</main></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html' } }
  );
  if (pathname === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, { status: 200 });
  if (pathname === '/sitemap.xml') return new Response(`<urlset><url><loc>${base}/</loc></url></urlset>`, { status: 200 });
  if (pathname === '/ads.txt') return new Response('google.com, pub-7492088381598802, DIRECT, f08c47fec0942fa0\n', { status: 200 });
  if (pathname === '/admin') return new Response('Not found', { status: 404 });
  return null;
}

function healthyFetch({ base, items = [], ready = true, includeV1Header = true, requests = [] } = {}) {
  return async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    requests.push({ url: String(url), method: options.method || 'GET' });
    const fixed = publicStatic(pathname, base);
    if (fixed) return fixed;
    if (pathname === '/api/functions/amazon-redirect') return jsonResponse({ redirectUrl: 'https://www.amazon.com/dp/B08PZHYWJS?tag=test-20' });
    if (pathname === '/api/health') return jsonResponse({ status: 'ok' });
    if (pathname === '/api/ready') return jsonResponse({ status: ready ? 'ready' : 'starting' });
    if (pathname === '/api/v1/meta') return jsonResponse({ apiVersion: '1' }, { v1: includeV1Header });
    if (pathname === '/api/v1/deals/feed') return jsonResponse({ items, nextCursor: null }, { v1: true });
    if (pathname.startsWith('/api/v1/deals/')) {
      const id = pathname.split('/').pop();
      return jsonResponse({ id, asin: id }, { v1: true });
    }
    throw new Error(`unexpected ${pathname}`);
  };
}

test('release smoke accepts HTTPS deployments and localhost HTTP only', async () => {
  const { cleanBaseUrl } = await loadSmoke();
  assert.equal(cleanBaseUrl('https://deals.example.com/'), 'https://deals.example.com');
  assert.equal(cleanBaseUrl('http://localhost:8080/'), 'http://localhost:8080');
  assert.throws(() => cleanBaseUrl('http://deals.example.com'), /HTTPS/);
  assert.throws(() => cleanBaseUrl('not-a-url'), /absolute URL/);
});

test('release smoke validates public site, affiliate path, readiness and v1 contracts', async () => {
  const { runReleaseSmoke } = await loadSmoke();
  const base = 'https://deals.example.com';
  const requests = [];
  const fetchImpl = healthyFetch({ base, items: [{ id: 'B000000001', asin: 'B000000001' }], requests });
  const result = await runReleaseSmoke(base, { fetchImpl, timeoutMs: 1000 });

  for (const check of ['public-home-adsense','public-home-indexable','robots-indexable','sitemap-indexable','adsense-ads-txt','private-admin-hidden','affiliate-redirect','liveness','readiness','v1-meta','v1-feed','v1-deal-detail']) {
    assert.ok(result.checks.includes(check), `missing ${check}`);
  }
  assert.equal(result.inventoryObserved, true);
  assert.equal(requests.filter((request) => request.method === 'POST').length, 1);
  assert.ok(requests.some((request) => request.url.includes('/api/functions/amazon-redirect') && request.method === 'POST'));
});

test('release smoke permits an empty public catalog but validates the public surface', async () => {
  const { runReleaseSmoke } = await loadSmoke();
  const base = 'https://deals.example.com';
  const result = await runReleaseSmoke(base, { fetchImpl: healthyFetch({ base, items: [] }), timeoutMs: 1000 });
  assert.equal(result.inventoryObserved, false);
  assert.ok(result.checks.includes('v1-feed'));
  assert.equal(result.checks.includes('v1-deal-detail'), false);
  assert.ok(result.checks.includes('public-home-indexable'));
});

test('release smoke fails closed on readiness or v1 tracing regressions', async () => {
  const { runReleaseSmoke } = await loadSmoke();
  const base = 'https://deals.example.com';
  await assert.rejects(
    () => runReleaseSmoke(base, { fetchImpl: healthyFetch({ base, ready: false }), timeoutMs: 1000 }),
    /status=ready/
  );
  await assert.rejects(
    () => runReleaseSmoke(base, { fetchImpl: healthyFetch({ base, includeV1Header: false }), timeoutMs: 1000 }),
    /X-DealScout-API-Version/
  );
});
