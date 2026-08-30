const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.AMAZON_ASSOCIATE_TAG = 'real-tag-20';
const { normalizeStrictPaapiItem } = require('../server/services/amazonPaapiStrictAdapter');

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
  assert.equal(source.includes('liveInfo.isDeal === false'), true);
  assert.equal(source.includes("'Verified deal ended'"), true);
});

test('Rainforest strict product lookup only allows non-deal snapshots when explicitly requested', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'rainforestStrictAdapter.js'), 'utf8');
  assert.equal(source.includes('allowNonDeal = false'), true);
  assert.equal(source.includes('if (!hasVerifiedDiscount && !allowNonDeal)'), true);
  assert.equal(source.includes('isDeal: hasVerifiedDiscount'), true);
});
