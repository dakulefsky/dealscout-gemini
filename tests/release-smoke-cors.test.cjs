const test = require('node:test');
const assert = require('node:assert/strict');

async function smokeModule() {
  return import('../scripts/release-smoke.mjs');
}

function jsonResponse(body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-request-id': 'req-test', ...headers },
  });
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
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    if (path === '/api/health') return jsonResponse({ status: 'ok' });
    if (path === '/api/ready') return jsonResponse({ status: 'ready' });
    if (path === '/api/v1/meta') {
      const corsHeaders = options.headers?.Origin
        ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' }
        : {};
      return jsonResponse({ apiVersion: '1' }, { 'x-dealscout-api-version': '1', ...corsHeaders });
    }
    if (path === '/api/v1/deals/feed') {
      return jsonResponse({ items: [], nextCursor: null }, { 'x-dealscout-api-version': '1' });
    }
    throw new Error(`Unexpected smoke URL: ${url}`);
  };

  const result = await runReleaseSmoke('https://api.example.com', { browserOrigin: origin, fetchImpl });
  assert.ok(result.checks.includes('browser-cors'));
  assert.equal(result.browserOrigin, origin);
  assert.ok(calls.some((call) => call.options.headers?.Origin === origin));
});

test('release smoke fails when the configured browser origin is not allowed', async () => {
  const { runReleaseSmoke } = await smokeModule();
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === '/api/health') return jsonResponse({ status: 'ok' });
    if (path === '/api/ready') return jsonResponse({ status: 'ready' });
    if (path === '/api/v1/meta') return jsonResponse({ apiVersion: '1' }, { 'x-dealscout-api-version': '1' });
    throw new Error(`Unexpected smoke URL: ${url}`);
  };

  await assert.rejects(
    runReleaseSmoke('https://api.example.com', { browserOrigin: 'https://frontend.example.com', fetchImpl }),
    /did not allow configured browser origin/
  );
});
