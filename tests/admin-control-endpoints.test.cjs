const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadCommonJs(file, dependencies) {
  const module = { exports: {} };
  const factory = vm.runInThisContext(`(function(require, module, exports) { ${fs.readFileSync(file, 'utf8')}\n})`, { filename: file });
  factory(name => dependencies[name] ?? {}, module, module.exports);
  return module.exports;
}

function queryFixture(configured, rows = []) {
  const queries = [];
  const repository = loadCommonJs('server/repositories/dealQueryRepository.js', {
    './dealRepository': { listAll: async () => rows, ensureSchema: async () => {}, normalizeRecord: row => row },
    '../storage/postgres': { isConfigured: () => configured, query: async (sql, params) => { queries.push({ sql, params }); return { rows: [] }; } },
    './editorialRepository': { ensureSchema: async () => {}, listForAsins: async () => [{ asin: 'B000000002', is_human_pick: true }] },
    '../services/publicDealPolicy': { isPublicDeal: row => row.status === 'APPROVED', minimumDiscountPercent: () => 15, freshPriceThreshold: () => 100 },
  });
  return { repository, queries };
}

test('admin queries filter before pagination and bind offsets and search as SQL parameters', async () => {
  const { repository, queries } = queryFixture(true);
  await repository.list({ status: 'PENDING_REVIEW', q: "test' OR 1=1", offset: '100', limit: '100' }, { isAdmin: true });
  assert.match(queries[0].sql, /status = \$1/);
  assert.match(queries[0].sql, /ORDER BY created_at DESC, id ASC/);
  assert.match(queries[0].sql, /LIMIT \$3 OFFSET \$4/);
  assert.deepEqual(queries[0].params, ['PENDING_REVIEW', "%test' OR 1=1%", 100, 100]);
  assert.doesNotMatch(queries[0].sql, /test' OR 1=1/);
  await repository.list({ ended: '1' }, { isAdmin: true });
  assert.match(queries[1].sql, /is_expired = 1 OR status = 'EXPIRED'/);
  await repository.list({ humanPick: '1' }, { isAdmin: true });
  assert.match(queries[2].sql, /EXISTS .*deal_editorial.*is_human_pick = TRUE/);
});

test('shopper query ignores internal pick, ended and offset filters and preserves visibility policy', async () => {
  const { repository, queries } = queryFixture(true);
  await repository.list({ status: 'REJECTED', ended: '1', humanPick: '1', offset: 100 });
  assert.match(queries[0].sql, /status = 'APPROVED'/);
  assert.match(queries[0].sql, /source_verified = 1/);
  assert.doesNotMatch(queries[0].sql, /OFFSET|deal_editorial|REJECTED|is_expired = 1/);
});

test('local catalog reaches older review records and picks beyond the first 100', async () => {
  const rows = Array.from({ length: 130 }, (_, index) => ({ id: String(index), asin: `B${String(index).padStart(9, '0')}`, title: 'Product', created_at: 130 - index, status: index >= 110 ? 'PENDING_REVIEW' : 'APPROVED', is_expired: index === 1 ? 1 : 0 }));
  const { repository } = queryFixture(false, rows);
  assert.equal((await repository.list({ status: 'PENDING_REVIEW' }, { isAdmin: true })).length, 20);
  assert.equal((await repository.list({ offset: 100 }, { isAdmin: true })).length, 30);
  assert.deepEqual((await repository.list({ humanPick: '1' }, { isAdmin: true })).map(row => row.asin), ['B000000002']);
  assert.deepEqual((await repository.list({ ended: '1' }, { isAdmin: true })).map(row => row.id), ['1']);
});

function functionsFixture(result) {
  const routes = new Map(); const calls = [];
  const router = Object.fromEntries(['get', 'post'].map(method => [method, (path, ...handlers) => routes.set(`${method}:${path}`, handlers.at(-1))]));
  loadCommonJs('server/routes/functions.js', {
    express: { Router: () => router }, '../middleware/auth': { requireAdmin: () => {} },
    '../repositories/dealRepository': { lifecycleStats: async () => ({}) },
    '../services/cronService': {
      syncDailyDeals: async options => { calls.push(options); return result; },
      checkDealPricesAndAvailability: async options => { calls.push(options); return result; },
    },
  });
  return { calls, run: async (path, body = {}) => {
    let status = 200; let json;
    const response = { status: value => { status = value; return response; }, json: value => { json = value; return response; } };
    await routes.get(`post:${path}`)({ body }, response);
    return { status, json };
  } };
}

for (const reason of ['LOCK_HELD', 'ALREADY_RUNNING']) test(`manual discovery reports ${reason} instead of a false success`, async () => {
  const { run } = functionsFixture({ skipped: true, reason });
  const response = await run('/fetch-deals');
  assert.equal(response.status, 409);
  assert.equal(response.json.code, 'DISCOVERY_NOT_RUN');
  assert.match(response.json.error, /already running/);
});

for (const [code, status] of [['PROVIDER_PAUSED', 409], ['PROVIDER_BUDGET_EXCEEDED', 429], ['PROVIDER_COOLDOWN', 503]]) test(`manual discovery clearly reports ${code}`, async () => {
  const { run } = functionsFixture({ status: 'DEFERRED', code });
  const response = await run('/fetch-deals');
  assert.equal(response.status, status);
  assert.equal(response.json.code, code);
});

test('manual discovery and price verification send bounded requests and preserve the override choice', async () => {
  const { run, calls } = functionsFixture({ created: 2 });
  assert.equal((await run('/fetch-deals', { maxDeals: 15, overrideDailyLimit: true })).json.created, 2);
  assert.deepEqual(calls[0], { maxResults: 15, overrideDailyLimit: true });
  await run('/verify-prices', { limit: 999 });
  assert.deepEqual(calls[1], { maxChecks: 6 });
});

test('image repair has a bounded batch and reports running jobs without false success', async () => {
  let limit; let skipped = false;
  const { imageRepairEndpoint } = loadCommonJs('server/middleware/imageRepairEndpoint.js', {
    './auth': { requireAdmin: (_req, _res, next) => next() },
    '../services/imageRepairService': { repairMissingImages: async value => { limit = value; return skipped ? { skipped: true } : { repaired: 1 }; } },
  });
  const run = async () => {
    let status = 200; let json;
    const res = { status(value) { status = value; return res; }, json(value) { json = value; return res; } };
    await imageRepairEndpoint({ method: 'POST', path: '/repair-images', body: { limit: 30 } }, res, () => assert.fail('Route missed'));
    return { status, json };
  };
  assert.equal((await run()).json.repaired, 1);
  assert.equal(limit, 3);
  skipped = true;
  assert.equal((await run()).status, 409);
});

test('admin API client wires controls to authenticated endpoints with the correct payloads', async () => {
  const { createDealScoutClient, MAINTENANCE_TIMEOUT_MS } = await import('../src/lib/apiCore.js');
  const calls = []; const timeouts = [];
  const client = createDealScoutClient({
    getToken: async () => 'test-admin-token',
    fetchImpl: async (url, options) => { calls.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, auth: options.headers.Authorization }); return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({}) }; },
    timers: { setTimeoutImpl: (_fn, ms) => { timeouts.push(ms); return 1; }, clearTimeoutImpl: () => {} },
  });
  const expected = [
    ['fetchDeals', [15, true], '/fetch-deals', { maxDeals: 15, overrideDailyLimit: true }],
    ['verifyPrices', [6], '/verify-prices', { limit: 6 }],
    ['repairImages', [3], '/repair-images', { limit: 3 }],
    ['cleanupLegacyEnrichment', [], '/legacy-enrichment-cleanup', undefined],
    ['setProviderApiEnabled', [false], '/channel-settings', { providerApiEnabled: false }],
    ['setWhatsAppStatusEnabled', [false], '/channel-settings', { whatsappStatusEnabled: false }],
    ['setJewishCalendarLocation', ['new_york'], '/jewish-calendar', { location: 'new_york' }],
    ['setSeoVerificationToken', ['existing-token'], '/seo-settings', { token: 'existing-token' }],
    ['setAmazonPrimeDayDates', ['2026-10-13', '2026-10-14'], '/amazon-seasonal-promotion', { primeDayStart: '2026-10-13', primeDayEnd: '2026-10-14' }],
    ['siteStripeImport', ['B000000001', false], '/sitestripe-import', { input: 'B000000001', inputUrl: 'B000000001', autoApprove: false }],
  ];
  for (const [name, args, path, body] of expected) {
    await client.functions[name](...args);
    assert.deepEqual(calls.at(-1), { url: `/api/functions${path}`, method: 'POST', body, auth: 'Bearer test-admin-token' });
  }
  assert.equal(timeouts[2], MAINTENANCE_TIMEOUT_MS, 'image repair uses a maintenance deadline rather than the short ordinary request timeout');
  await client.editorial.save('B000000001', { isHumanPick: true });
  assert.equal(calls.at(-1).url, '/api/editorial/B000000001');
  assert.equal(calls.at(-1).method, 'PUT');
  await client.deals.update('B000000001', { status: 'REJECTED' });
  assert.equal(calls.at(-1).method, 'PATCH');
  await client.deals.delete('B000000001');
  assert.equal(calls.at(-1).method, 'DELETE');
});
