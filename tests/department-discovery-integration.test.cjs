const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const deals = require('../server/repositories/dealRepository');
const budget = require('../server/services/providerBudgetService');
const settings = require('../server/services/siteRuntimeSettingsService');
const { fetchDealsList } = require('../server/services/providerRouter');

test('actual discovery router learns taxonomy, targets thin departments and preserves manual choice with one budgeted request each', async () => {
  const originalGet = axios.get;
  const originalList = deals.listAll;
  const keys = ['RAINFOREST_API_KEY', 'AMAZON_ASSOCIATE_TAG', 'DEAL_DATA_PROVIDER'];
  const originals = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const requests = [];
  try {
    settings.resetLocalSettings(); budget.resetLocalUsage();
    Object.assign(process.env, { RAINFOREST_API_KEY: 'test-only', AMAZON_ASSOCIATE_TAG: 'test-20', DEAL_DATA_PROVIDER: 'rainforest' });
    deals.listAll = async () => Array.from({ length: 8 }, (_, i) => ({ asin: `A${String(i).padStart(9, '0')}`, title: `Laptop ${i}`, category: 'Electronics', source_verified: 1, is_expired: 0, status: 'APPROVED', original_price: 100, sale_price: 60, price_check_at: Math.floor(Date.now() / 1000) }));
    axios.get = async (_url, options) => {
      requests.push(options.params);
      return { data: { categories: [{ category_id: '123', name: 'Baby' }, { category_id: '456', name: 'Pet Supplies' }, { category_id: '789', name: 'Electronics' }], deals_results: [
        { asin: 'B000000001', title: 'Baby stroller', category: 'Baby', price: { value: 60 }, rrp: { value: 100 }, image: 'https://m.media-amazon.com/images/I/product.jpg' },
      ] } };
    };
    await fetchDealsList();
    await fetchDealsList();
    await fetchDealsList({ categoryId: '999' });
    await fetchDealsList();
    assert.equal(requests.length, 4);
    assert.equal(requests[0].category_id, undefined, 'cold start learns IDs with a broad response');
    assert.deepEqual(new Set(requests[1].category_id.split(',')), new Set(['123', '456']), 'full Electronics is excluded from the targeted pull');
    assert.equal(requests[2].category_id, '999', 'manual targeting wins');
    assert.equal(requests[3].category_id, undefined, 'one in three pulls stays broad');
    assert.ok(requests.every(params => !params.max_page && !params.page));
    const status = await budget.usageStatus('rainforest');
    assert.equal(status.monthCount, 4);
    assert.equal(status.limits.monthly, 500);
  } finally {
    axios.get = originalGet; deals.listAll = originalList;
    for (const key of keys) { if (originals[key] === undefined) delete process.env[key]; else process.env[key] = originals[key]; }
    settings.resetLocalSettings(); budget.resetLocalUsage();
  }
});
