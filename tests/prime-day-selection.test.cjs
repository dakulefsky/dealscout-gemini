const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../server/services/siteRuntimeSettingsService');
const prime = require('../server/services/primeDayPolicy');
const { minimumDiscountPercent, isPublicDeal } = require('../server/services/publicDealPolicy');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');
const budget = require('../server/services/providerBudgetService');
const item = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 90, imageUrl: 'https://example.com/a.jpg', sourceVerified: true, availability: 'In Stock' };
async function configure() {
  settings.resetLocalSettings();
  await settings.set('amazon_prime_day_start', '2027-07-12');
  await settings.set('amazon_prime_day_end', '2027-07-13');
  await prime.refresh();
}
test('admin dates control the window, including its exact New York boundaries', async () => {
  await configure();
  assert.equal(minimumDiscountPercent(Date.parse('2027-07-12T03:59:59Z')), 15);
  assert.equal(minimumDiscountPercent(Date.parse('2027-07-12T04:00:00Z')), 10);
  assert.equal(minimumDiscountPercent(Date.parse('2027-07-14T03:59:59Z')), 10);
  assert.equal(minimumDiscountPercent(Date.parse('2027-07-14T04:00:00Z')), 15);
  assert.equal(minimumDiscountPercent(Date.parse('2028-07-12T12:00:00Z')), 15);
  await settings.set('amazon_prime_day_start', '');
  await settings.set('amazon_prime_day_end', '');
  await prime.refresh();
  assert.equal(minimumDiscountPercent(Date.parse('2027-07-12T12:00:00Z')), 15);
});
test('temporary admission preserves verification and ranks stronger discounts higher', async () => {
  await configure();
  const now = Date.parse('2027-07-12T12:00:00Z');
  const modest = scoreVerifiedDeal(item, now);
  assert.equal(modest.decision, 'AUTO_APPROVE');
  assert.ok(scoreVerifiedDeal({ ...item, salePrice: 60 }, now).score > modest.score);
  assert.equal(scoreVerifiedDeal({ ...item, sourceVerified: false }, now).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal({ ...item, imageUrl: '' }, now).decision, 'PENDING_REVIEW');
  assert.equal(scoreVerifiedDeal({ ...item, salePrice: 20 }, now).decision, 'PENDING_REVIEW');
  const deal = { ...item, status: 'APPROVED', priceCheckAt: now / 1000 };
  assert.equal(isPublicDeal(deal, { nowSeconds: now / 1000 }), true);
  assert.equal(isPublicDeal(deal, { nowSeconds: Date.parse('2027-07-14T04:00:00Z') / 1000 }), false);
});
test('20 daily calls are shared and cannot bypass the monthly cap during Prime Day', async () => {
  await configure();
  budget.resetLocalUsage();
  const now = new Date('2027-07-12T12:00:00Z');
  assert.deepEqual(budget.limitsFor('rainforest', now), { daily: 20, monthly: 500 });
  for (let i = 0; i < 20; i++) await budget.reserveRequest('rainforest', now);
  await assert.rejects(budget.reserveRequest('rainforest', now, { overrideDailyLimit: true }), e => e.scope === 'day');
  budget.resetLocalUsage();
  const before = new Date('2027-07-01T12:00:00Z');
  for (let i = 0; i < 500; i++) await budget.reserveRequest('rainforest', before, { overrideDailyLimit: true });
  await assert.rejects(budget.reserveRequest('rainforest', now, { overrideDailyLimit: true }), e => e.scope === 'month');
  assert.equal(budget.limitsFor('rainforest', new Date('2027-07-14T04:00:00Z')).daily, 16);
  settings.resetLocalSettings();
  budget.resetLocalUsage();
});
test('Prime discovery retains more good candidates from one paid page, strongest tier first', async () => {
  const axios = require('axios');
  const { fetchStrictRainforestDeals } = require('../server/services/rainforestStrictDiscovery');
  const originalGet = axios.get;
  const originalKey = process.env.RAINFOREST_API_KEY;
  const originalTag = process.env.AMAZON_ASSOCIATE_TAG;
  let calls = 0;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const rows = Array.from({ length: 90 }, (_, i) => ({
    asin: `B${String(i).padStart(9, '0')}`, title: `Product ${i}`, price: { value: i < 70 ? 60 : 90 }, rrp: { value: 100 },
    image: 'https://m.media-amazon.com/images/I/product.jpg', category: i % 2 ? 'Electronics' : 'Home & Kitchen',
  }));
  try {
    process.env.RAINFOREST_API_KEY = 'test-key';
    process.env.AMAZON_ASSOCIATE_TAG = 'test-20';
    axios.get = async () => { calls++; return { data: { deals_results: rows } }; };
    settings.resetLocalSettings();
    await settings.set('amazon_prime_day_start', today);
    await settings.set('amazon_prime_day_end', today);
    const result = await fetchStrictRainforestDeals({ maxResults: 15 });
    assert.equal(calls, 1);
    assert.equal(result.length, 75);
    assert.ok(result.slice(0, 70).every(deal => deal.discountPercent === 40));
    assert.ok(result.slice(70).every(deal => deal.discountPercent === 10));
    assert.equal(new Set(result.map(deal => deal.asin)).size, 75);
    settings.resetLocalSettings();
    assert.equal((await fetchStrictRainforestDeals({ maxResults: 15 })).length, 40);
  } finally {
    axios.get = originalGet;
    if (originalKey === undefined) delete process.env.RAINFOREST_API_KEY; else process.env.RAINFOREST_API_KEY = originalKey;
    if (originalTag === undefined) delete process.env.AMAZON_ASSOCIATE_TAG; else process.env.AMAZON_ASSOCIATE_TAG = originalTag;
    settings.resetLocalSettings();
  }
});
