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

async function requestJson(baseUrl, requestPath, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}${requestPath}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'DealScout-Release-Smoke/1' },
      signal: controller.signal,
      redirect: 'error',
    });
    let body = null;
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json')) {
      try { body = await response.json(); } catch { body = null; }
    }
    if (!response.ok) {
      const detail = body?.error || `HTTP ${response.status}`;
      throw new Error(`${requestPath} failed: ${detail}`);
    }
    return { response, body };
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
  const fetchOptions = { timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS, fetchImpl: options.fetchImpl };
  const checks = [];

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

  return { target, checks, inventoryObserved: Boolean(firstDeal) };
}

async function main() {
  const target = process.argv[2] || process.env.DEALSCOUT_SMOKE_URL;
  const result = await runReleaseSmoke(target);
  console.log(`DealScout release smoke passed for ${result.target}`);
  console.log(`Checks: ${result.checks.join(', ')}`);
  if (!result.inventoryObserved) console.log('Feed is healthy but currently contains no public inventory; detail lookup skipped.');
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirect) {
  main().catch((error) => {
    console.error(`Release smoke failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export { DEFAULT_TIMEOUT_MS, cleanBaseUrl, requestJson, assertV1Headers, runReleaseSmoke };
