const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const settings = require('../server/services/siteRuntimeSettingsService');
const { fetchStrictRainforestDeals } = require('../server/services/rainforestStrictDiscovery');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

const row = (id, sale, image = true) => ({
  asin: `B${String(id).padStart(9, '0')}`, title: `Product ${id}`, price: { value: sale }, rrp: { value: 100 },
  ...(image ? { image: 'https://m.media-amazon.com/images/I/product.jpg' } : {}),
  category: id % 2 ? 'Electronics' : 'Home & Kitchen',
});

test('ordinary discovery keeps 40 publishable deals before extreme-discount review candidates, in one call', async () => {
  const originalGet = axios.get;
  const originalKey = process.env.RAINFOREST_API_KEY;
  const originalTag = process.env.AMAZON_ASSOCIATE_TAG;
  let calls = 0;
  const strong = Array.from({ length: 45 }, (_, i) => row(i, 60));
  const extreme = Array.from({ length: 50 }, (_, i) => row(i + 100, 10));
  try {
    settings.resetLocalSettings();
    process.env.RAINFOREST_API_KEY = 'test-only';
    process.env.AMAZON_ASSOCIATE_TAG = 'test-20';
    axios.get = async () => { calls++; return { data: { deals_results: [...extreme, ...strong, row(300, 90)] } }; };
    const result = await fetchStrictRainforestDeals({ maxResults: 15, refreshExistingAsins: [' b000000300 '] });
    assert.equal(calls, 1);
    assert.equal(result.length, 41, 'forty new candidates plus a free existing observation');
    assert.equal(result[0].asin, 'B000000300');
    assert.ok(result.slice(1).every(deal => deal.discountPercent === 40));
    assert.ok(result.slice(1).every(deal => scoreVerifiedDeal(deal).decision === 'AUTO_APPROVE'));
    assert.equal(new Set(result.map(deal => deal.asin)).size, result.length);

    axios.get = async () => { calls++; return { data: { deals_results: [row(1, 60), row(2, 84), row(3, 90), row(4, 10), row(5, 60, false)] } }; };
    const smaller = await fetchStrictRainforestDeals({ maxResults: 15 });
    assert.equal(calls, 2, 'each pull still makes exactly one request');
    assert.equal(smaller[0].discountPercent, 40);
    assert.equal(smaller[1].discountPercent, 16, 'publishable modest deals precede review-only extreme discounts');
    assert.ok(smaller.some(deal => deal.discountPercent === 16), 'ordinary qualifying discounts remain eligible');
    assert.ok(!smaller.some(deal => deal.discountPercent === 10), 'ordinary savings floor is unchanged');
    assert.ok(smaller.some(deal => scoreVerifiedDeal(deal).decision === 'PENDING_REVIEW'), 'manual review candidates still retained in spare slots');
  } finally {
    axios.get = originalGet;
    if (originalKey === undefined) delete process.env.RAINFOREST_API_KEY; else process.env.RAINFOREST_API_KEY = originalKey;
    if (originalTag === undefined) delete process.env.AMAZON_ASSOCIATE_TAG; else process.env.AMAZON_ASSOCIATE_TAG = originalTag;
    settings.resetLocalSettings();
  }
});
