const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.AMAZON_ASSOCIATE_TAG = 'real-tag-20';
const { normalizeStrictPaapiItem } = require('../server/services/amazonPaapiStrictAdapter');
const cronService = require('../server/services/cronService');

test('PA-API discovery still rejects products without a verified discount', () => {
  const item = {
    ASIN: 'B0GGGQDY9H',
    ItemInfo: { Title: { DisplayValue: 'Product' } },
    Offers: { Listings: [{ Price: { Amount: 79.99 } }] },
  };
  assert.equal(normalizeStrictPaapiItem(item), null);
});

test('PA-API upkeep can return a verified non-deal snapshot', () => {
  const item = normalizeStrictPaapiItem({
    ASIN: 'B0GGGQDY9H',
    ItemInfo: { Title: { DisplayValue: 'Product' } },
    Offers: { Listings: [{ Price: { Amount: 79.99 } }] },
  }, { allowNonDeal: true });

  assert.ok(item);
  assert.equal(item.sourceVerified, true);
  assert.equal(item.isDeal, false);
  assert.equal(item.salePrice, 79.99);
  assert.equal(item.originalPrice, 79.99);
  assert.equal(item.discountPercent, 0);
});

test('cron requests non-deal snapshots and expires verified ended discounts', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'cronService.js'), 'utf8');
  assert.equal(source.includes("fetchProductByAsin(deal.asin, { allowNonDeal: true })"), true);
  assert.equal(source.includes('verifiedDealEnded(liveInfo)'), true);
  assert.equal(source.includes("'Verified deal ended'"), true);
});

test('verification treats equal or reversed live prices as ended even with stale discount metadata', () => {
  assert.equal(cronService.verifiedDealEnded({ isDeal: true, originalPrice: 100, salePrice: 100, discountPercent: 25 }), true);
  assert.equal(cronService.verifiedDealEnded({ isDeal: true, originalPrice: 90, salePrice: 100, discountPercent: 25 }), true);
  assert.equal(cronService.verifiedDealEnded({ isDeal: true, originalPrice: 100, salePrice: 80, discountPercent: 20 }), false);
  assert.equal(cronService.verifiedDealEnded({ isDeal: false, originalPrice: 100, salePrice: 80, discountPercent: 20 }), true);
});

test('Rainforest strict product lookup only allows non-deal snapshots when explicitly requested', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'rainforestStrictAdapter.js'), 'utf8');
  assert.equal(source.includes('allowNonDeal = false'), true);
  assert.equal(source.includes('if (!hasVerifiedDiscount && !allowNonDeal)'), true);
  assert.equal(source.includes('isDeal: hasVerifiedDiscount'), true);
});
