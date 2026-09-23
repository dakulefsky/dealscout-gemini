import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 10_000;

function cleanBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Provide DEALSCOUT_SMOKE_URL or pass the deployment URL as the first argument');
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Smoke URL must be an absolute URL'); }
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new Error('Smoke URL must use HTTPS outside localhost');
  }
  parsed.pathname = parsed.pathname.replace(/\/$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function cleanBrowserOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Browser smoke origin must be an absolute URL'); }
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new Error('Browser smoke origin must use HTTPS outside localhost');
  }
  return parsed.origin;
}

async function requestJson(baseUrl, requestPath, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  headers = {},
  method = 'GET',
  body: requestBody,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}${requestPath}`, {
      method,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DealScout-Release-Smoke/1',
        ...(requestBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: requestBody !== undefined ? JSON.stringify(requestBody) : undefined,
      signal: controller.signal,
      redirect: 'error',
    });
    let responseBody = null;
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json')) {
      try { responseBody = await response.json(); } catch { responseBody = null; }
    }
    if (!response.ok) {
      const detail = responseBody?.error || `HTTP ${response.status}`;
      throw new Error(`${requestPath} failed: ${detail}`);
    }
    return { response, body: responseBody };
  } catch (error) {
    if (controller.signal.aborted && error?.name === 'AbortError') throw new Error(`${requestPath} timed out`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertV1Headers(response, requestPath) {
  assert(response.headers.get('x-dealscout-api-version') === '1', `${requestPath} missing X-DealScout-API-Version: 1`);
  const requestId = response.headers.get('x-request-id');
  assert(Boolean(requestId), `${requestPath} missing X-Request-ID`);
}

async function runReleaseSmoke(baseUrl, options = {}) {
  const target = cleanBaseUrl(baseUrl);
  const browserOrigin = cleanBrowserOrigin(options.browserOrigin);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const fetchOptions = { timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS, fetchImpl };
  const checks = [];

  const homepage = await fetchImpl(`${target}/`, {
    headers: { 'User-Agent': 'DealScout-Release-Smoke/1' },
    redirect: 'error',
  });
  assert(homepage.ok, `homepage failed: HTTP ${homepage.status}`);
  const homepageHtml = await homepage.text();
  assert(homepageHtml.includes('ca-pub-7492088381598802'), 'homepage is missing the configured AdSense site code');
  checks.push('public-home-adsense');

  assert(homepageHtml.includes(`<link rel="canonical" href="${target}/" />`), 'homepage is missing the public canonical URL');
  assert(/<meta\s+name=["']robots["']\s+content=["']index,follow["']/i.test(homepageHtml), 'homepage is not explicitly indexable');
  assert(homepageHtml.includes('data-server-crawl-content="home"'), 'homepage is missing server-rendered crawl content');
  checks.push('public-home-indexable');

  const robots = await fetchImpl(`${target}/robots.txt`, {
    headers: { 'User-Agent': 'DealScout-Release-Smoke/1' },
    redirect: 'error',
  });
  assert(robots.ok, `robots.txt failed: HTTP ${robots.status}`);
  const robotsBody = await robots.text();
  assert(/Allow:\s*\//.test(robotsBody), 'robots.txt does not allow public crawling');
  assert(robotsBody.includes(`Sitemap: ${target}/sitemap.xml`), 'robots.txt points at the wrong sitemap origin');
  checks.push('robots-indexable');

  const sitemap = await fetchImpl(`${target}/sitemap.xml`, {
    headers: { 'User-Agent': 'DealScout-Release-Smoke/1' },
    redirect: 'error',
  });
  assert(sitemap.ok, `sitemap.xml failed: HTTP ${sitemap.status}`);
  const sitemapBody = await sitemap.text();
  assert(sitemapBody.includes(`<loc>${target}/</loc>`), 'sitemap is missing the public homepage');
  assert(!sitemapBody.includes('/admin'), 'sitemap must never expose admin URLs');
  checks.push('sitemap-indexable');

  const adsTxt = await fetchImpl(`${target}/ads.txt`, {
    headers: { 'User-Agent': 'DealScout-Release-Smoke/1' },
    redirect: 'error',
  });
  assert(adsTxt.ok, `ads.txt failed: HTTP ${adsTxt.status}`);
  const adsTxtBody = (await adsTxt.text()).trim();
  assert(adsTxtBody.split(/\r?\n/).includes('google.com, pub-7492088381598802, DIRECT, f08c47fec0942fa0'), 'ads.txt is missing the authorized AdSense seller record');
  checks.push('adsense-ads-txt');

  const admin = await fetchImpl(`${target}/admin`, {
    headers: { 'User-Agent': 'DealScout-Release-Smoke/1' },
    redirect: 'manual',
  });
  assert(admin.status === 404, `public /admin must return 404, received HTTP ${admin.status}`);
  checks.push('private-admin-hidden');

  const affiliate = await requestJson(target, '/api/functions/amazon-redirect', {
    ...fetchOptions,
    method: 'POST',
    body: { url: 'https://www.amazon.com/dp/B08PZHYWJS' },
  });
  assert(/^https:\/\/(?:www\.)?amazon\.com\//i.test(String(affiliate.body?.redirectUrl || '')), 'affiliate redirect endpoint did not return an Amazon URL');
  checks.push('affiliate-redirect');

  const health = await requestJson(target, '/api/health', fetchOptions);
  assert(health.body?.status === 'ok', '/api/health did not report status=ok');
  checks.push('liveness');

  const ready = await requestJson(target, '/api/ready', fetchOptions);
  assert(ready.body?.status === 'ready', '/api/ready did not report status=ready');
  checks.push('readiness');

  const meta = await requestJson(target, '/api/v1/meta', fetchOptions);
  assertV1Headers(meta.response, '/api/v1/meta');
  assert(String(meta.body?.apiVersion) === '1', '/api/v1/meta did not report apiVersion=1');
  checks.push('v1-meta');

  if (browserOrigin) {
    const cors = await requestJson(target, '/api/v1/meta', {
      ...fetchOptions,
      headers: { Origin: browserOrigin },
    });
    assert(cors.response.headers.get('access-control-allow-origin') === browserOrigin,
      `/api/v1/meta did not allow configured browser origin ${browserOrigin}`);
    assert(cors.response.headers.get('access-control-allow-credentials') === 'true',
      '/api/v1/meta missing Access-Control-Allow-Credentials: true');
    checks.push('browser-cors');
  }

  const feed = await requestJson(target, '/api/v1/deals/feed?limit=2&sort=-created_date', fetchOptions);
  assertV1Headers(feed.response, '/api/v1/deals/feed');
  assert(Array.isArray(feed.body?.items), '/api/v1/deals/feed items must be an array');
  assert(feed.body.nextCursor == null || typeof feed.body.nextCursor === 'string', '/api/v1/deals/feed nextCursor must be null or a string');
  checks.push('v1-feed');

  const firstDeal = feed.body.items[0];
  if (firstDeal) {
    const id = String(firstDeal.id || firstDeal.asin || '');
    assert(id, 'Feed returned a deal without id/asin');
    const detail = await requestJson(target, `/api/v1/deals/${encodeURIComponent(id)}`, fetchOptions);
    assertV1Headers(detail.response, '/api/v1/deals/:id');
    assert(String(detail.body?.id || detail.body?.asin || ''), 'Deal detail returned no id/asin');
    checks.push('v1-deal-detail');
  }

  return { target, browserOrigin, checks, inventoryObserved: Boolean(firstDeal) };
}

async function main() {
  const target = process.argv[2] || process.env.DEALSCOUT_SMOKE_URL;
  const result = await runReleaseSmoke(target, { browserOrigin: process.env.DEALSCOUT_SMOKE_ORIGIN });
  console.log(`DealScout release smoke passed for ${result.target}`);
  console.log(`Checks: ${result.checks.join(', ')}`);
  if (result.browserOrigin) console.log(`Browser CORS verified for ${result.browserOrigin}`);
  if (!result.inventoryObserved) console.log('Feed is healthy but currently contains no public inventory; detail lookup skipped.');
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirect) {
  main().catch((error) => {
    console.error(`Release smoke failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export { DEFAULT_TIMEOUT_MS, cleanBaseUrl, cleanBrowserOrigin, requestJson, assertV1Headers, runReleaseSmoke };
