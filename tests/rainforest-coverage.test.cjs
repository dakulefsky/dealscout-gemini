const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const supply = require('../server/services/departmentSupplyService');
const settings = require('../server/services/siteRuntimeSettingsService');
const budget = require('../server/services/providerBudgetService');
const deals = require('../server/repositories/dealRepository');
const postgres = require('../server/storage/postgres');
const { fetchDealsList, warmRainforestVerificationCache } = require('../server/services/providerRouter');
const { retainBulkDiscoveries } = require('../server/services/discoveryIntakeService');
const item = (asin, sale = 50, image = true) => ({ asin, title: `Useful kitchen utensil ${asin}`, originalPrice: 100, salePrice: sale, sourceVerified: true, imageUrl: image ? 'https://m.media-amazon.com/images/I/item.jpg' : null });

test('actual bulk verification admits new deals from its single already-budgeted response', async () => {
  const originalGet = axios.get, originalList = deals.listAll, originalUpsert = deals.upsert;
  const keys = ['RAINFOREST_API_KEY', 'AMAZON_ASSOCIATE_TAG', 'DEAL_DATA_PROVIDER'];
  const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  let calls = 0;
  const inserted = [];
  try {
    budget.resetLocalUsage();
    Object.assign(process.env, { RAINFOREST_API_KEY: 'offline-test', AMAZON_ASSOCIATE_TAG: 'test-20', DEAL_DATA_PROVIDER: 'rainforest' });
    deals.listAll = async () => [{ id: 'B000000001', asin: 'B000000001', status: 'REJECTED' }];
    deals.upsert = async (record, options) => { assert.equal(options.insertOnly, true); inserted.push(record); return record; };
    axios.get = async () => { calls++; return { data: { deals_results: ['B000000001', 'B000000005'].map(asin => ({
      asin, title: `Kitchen utensil ${asin}`, deal_price: { value: 50 }, list_price: { value: 100 }, image: 'https://m.media-amazon.com/images/I/item.jpg',
    })) } }; };
    const result = await warmRainforestVerificationCache();
    assert.equal(calls, 1);
    assert.equal(result.created, 1);
    assert.deepEqual(inserted.map(row => row.asin), ['B000000005']);
    assert.equal((await budget.usageStatus('rainforest')).monthCount, 1);
  } finally {
    axios.get = originalGet; deals.listAll = originalList; deals.upsert = originalUpsert;
    for (const key of keys) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; }
    budget.resetLocalUsage();
  }
});

test('real router explores pages across calls, revisits page one and saves diagnostics without extra credits', async () => {
  const originalGet = axios.get, originalList = deals.listAll;
  const originalEnv = { ...process.env };
  const requests = [];
  try {
    settings.resetLocalSettings(); budget.resetLocalUsage();
    Object.assign(process.env, { RAINFOREST_API_KEY: 'offline-test', AMAZON_ASSOCIATE_TAG: 'test-20', DEAL_DATA_PROVIDER: 'rainforest' });
    deals.listAll = async () => [];
    axios.get = async (_url, { params }) => {
      requests.push(params);
      return { data: { request_info: { credits_used_this_request: 1 }, pagination: { current_page: params.page, total_pages: 5 }, deals_results: [
        { asin: 'B000000001', title: 'Kitchen spatula', deal_price: { value: 50 }, list_price: { value: 100 }, image: 'https://m.media-amazon.com/images/I/item.jpg' },
        { asin: 'bad', title: 'Invalid' },
      ] } };
    };
    for (let i = 0; i < 8; i++) await fetchDealsList();
    assert.deepEqual(requests.map(row => row.page), [1, 2, 3, 1, 4, 5, 1, 2]);
    assert.ok(requests.every(row => !row.max_page));
    assert.equal((await budget.usageStatus('rainforest')).monthCount, 8);
    const state = JSON.parse((await settings.get('rainforest_department_discovery')).value);
    assert.equal(state.lastDiscovery.raw, 2);
    assert.equal(state.lastDiscovery.invalidIdentityOrPrices, 1);
    assert.equal(state.lastDiscovery.retainedNew, 1);
    assert.equal(state.lastDiscovery.creditsUsed, 1);
  } finally {
    axios.get = originalGet; deals.listAll = originalList;
    for (const key of ['RAINFOREST_API_KEY', 'AMAZON_ASSOCIATE_TAG', 'DEAL_DATA_PROVIDER']) {
      if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
    }
    settings.resetLocalSettings(); budget.resetLocalUsage();
  }
});

test('all learned IDs rotate and exhausted or stale pagination resets safely', async () => {
  settings.resetLocalSettings();
  try {
    const rows = [101, 102, 103, 104].map(category_id => ({ category_id, name: 'Electronics' }));
    await supply.recordDiscovery(await supply.prepareDiscovery([]), rows, { totalPages: 2, currentPage: 1 });
    const first = await supply.prepareDiscovery([]);
    assert.equal(first.categoryId, '101,102');
    await supply.recordDiscovery(first, rows, { totalPages: 2, currentPage: 1 });
    const second = await supply.prepareDiscovery([]);
    assert.equal(second.categoryId, '103,104');
    const now = Date.now();
    const state = { domain: 'amazon.com', pulls: 0, pageQueries: { broad: { visits: 2, nextPage: 9, totalPages: 2, at: now } } };
    assert.equal(supply.planDiscovery([], state, now).page, 2);
    state.pageQueries.broad.at = now - 8 * 86400000;
    assert.equal(supply.planDiscovery([], state, now).page, 1);
  } finally { settings.resetLocalSettings(); }
});

test('bulk intake uses quality and holdback policies and never replaces known or concurrently inserted deals', async () => {
  const original = deals.upsert;
  const oldHoldback = process.env.EDITORIAL_HOLDBACK_PERCENT;
  const inserted = [];
  try {
    process.env.EDITORIAL_HOLDBACK_PERCENT = '100';
    deals.upsert = async (record, options) => {
      assert.equal(options.insertOnly, true);
      if (record.asin === 'B000000004') return null;
      inserted.push(record); return record;
    };
    const result = await retainBulkDiscoveries([
      item('B000000001'), item('B000000002', 99), item('B000000003', 50, false),
      item('B000000004'), item('B000000005'), item('B000000005'),
    ], [{ asin: 'B000000001', status: 'REJECTED' }], 123);
    assert.deepEqual(result, { created: 2, pendingReview: 2 });
    assert.deepEqual(inserted.map(row => row.asin), ['B000000003', 'B000000005']);
    assert.ok(inserted.every(row => row.status === 'PENDING_REVIEW' && row.price_check_at === 123));
  } finally { deals.upsert = original; if (oldHoldback === undefined) delete process.env.EDITORIAL_HOLDBACK_PERCENT; else process.env.EDITORIAL_HOLDBACK_PERCENT = oldHoldback; }
});

test('PostgreSQL insert-only admission handles a conflict atomically without updating an existing deal', async () => {
  const originalConfigured = postgres.isConfigured, originalQuery = postgres.query;
  const originalCategory = require('../server/repositories/categoryRepository').ensureForDeal;
  const queries = [];
  try {
    postgres.isConfigured = () => true;
    postgres.query = async (sql) => { queries.push(sql); return { rows: [] }; };
    require('../server/repositories/categoryRepository').ensureForDeal = async value => value;
    const result = await deals.upsert({ id: 'B000000001', asin: 'B000000001', title: 'Kitchen spatula', original_price: 100, sale_price: 50 }, { insertOnly: true, skipEnsure: true });
    assert.equal(result, null);
    assert.match(queries[0], /ON CONFLICT DO NOTHING/);
    assert.doesNotMatch(queries[0], /DO UPDATE/);
  } finally { postgres.isConfigured = originalConfigured; postgres.query = originalQuery; require('../server/repositories/categoryRepository').ensureForDeal = originalCategory; }
});
