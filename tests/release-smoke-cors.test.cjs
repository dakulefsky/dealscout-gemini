const test = require('node:test');
const assert = require('node:assert/strict');

async function smokeModule() {
  return import('../scripts/release-smoke.mjs');
}

function jsonResponse(body, headers = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': 'req-test', ...headers },
  });
}

function staticResponse(path, base = 'https://api.example.com') {
  if (path === '/') {
    return new Response(`<html><head><meta name="robots" content="index,follow" /><link rel="canonical" href="${base}/" /></head><body><main data-server-crawl-content="home">ca-pub-7492088381598802</main></body></html>`, { status: 200, headers: { 'content-type': 'text/html' } });
  }
  if (path === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, { status: 200 });
  if (path === '/sitemap.xml') return new Response(`<urlset><url><loc>${base}/</loc></url></urlset>`, { status: 200 });
  if (path === '/ads.txt') return new Response('google.com, pub-7492088381598802, DIRECT, f08c47fec0942fa0\n', { status: 200 });
  if (path === '/admin') return new Response('Not found', { status: 404 });
  return null;
}

test('browser origin normalization requires HTTPS outside localhost', async () => {
  const { cleanBrowserOrigin } = await smokeModule();
  assert.equal(cleanBrowserOrigin('https://frontend.example.com/path?q=1'), 'https://frontend.example.com');
  assert.equal(cleanBrowserOrigin('http://localhost:5173/path'), 'http://localhost:5173');
  assert.throws(() => cleanBrowserOrigin('http://frontend.example.com'), /must use HTTPS/);
});

test('release smoke verifies reflected browser CORS and credentials', async () => {
  const { runReleaseSmoke } = await smokeModule();
  const origin = 'https://frontend.example.com';
  const base = 'https://api.example.com';
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    const fixed = staticResponse(path, base);
    if (fixed) return fixed;
    if (path === '/api/functions/amazon-redirect') return jsonResponse({ redirectUrl: 'https://www.amazon.com/dp/B08PZHYWJS?tag=test-20' });
    if (path === '/api/health') return jsonResponse({ status: 'ok' });
    if (path === '/api/ready') return jsonResponse({ status: 'ready' });
    if (path === '/api/v1/meta') {
      const corsHeaders = options.headers?.Origin
        ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' }
        : {};
      return jsonResponse({ apiVersion: '1' }, { 'x-dealscout-api-version': '1', ...corsHeaders });
    }
    if (path === '/api/v1/deals/feed') return jsonResponse({ items: [], nextCursor: null }, { 'x-dealscout-api-version': '1' });
    throw new Error(`Unexpected smoke URL: ${url}`);
  };

  const result = await runReleaseSmoke(base, { browserOrigin: origin, fetchImpl });
  assert.ok(result.checks.includes('browser-cors'));
  assert.equal(result.browserOrigin, origin);
  assert.ok(calls.some((call) => call.options.headers?.Origin === origin));
});

test('release smoke fails when the configured browser origin is not allowed', async () => {
  const { runReleaseSmoke } = await smokeModule();
  const base = 'https://api.example.com';
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    const fixed = staticResponse(path, base);
    if (fixed) return fixed;
    if (path === '/api/functions/amazon-redirect') return jsonResponse({ redirectUrl: 'https://www.amazon.com/dp/B08PZHYWJS?tag=test-20' });
    if (path === '/api/health') return jsonResponse({ status: 'ok' });
    if (path === '/api/ready') return jsonResponse({ status: 'ready' });
    if (path === '/api/v1/meta') return jsonResponse({ apiVersion: '1' }, { 'x-dealscout-api-version': '1' });
    if (path === '/api/v1/deals/feed') return jsonResponse({ items: [], nextCursor: null }, { 'x-dealscout-api-version': '1' });
    throw new Error(`Unexpected smoke URL: ${url}`);
  };

  await assert.rejects(
    runReleaseSmoke(base, { browserOrigin: 'https://frontend.example.com', fetchImpl }),
    /did not allow configured browser origin/
  );
});
