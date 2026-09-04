const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.AMAZON_ASSOCIATE_TAG = 'dankul-20';
const { selectDealsForIngestion } = require('../server/services/rainforestStrictDiscovery');

function deal(asin, category, discountPercent) {
  return { asin, category, discountPercent, savingsAmount: discountPercent, salePrice: 100 - discountPercent };
}

test('one paid Rainforest discovery response refreshes every existing ASIN it already observed', () => {
  const ranked = [
    deal('A000000001', 'Electronics', 60),
    deal('A000000002', 'Electronics', 59),
    deal('A000000003', 'Home & Kitchen', 58),
    deal('A000000004', 'Baby', 57),
    deal('A000000005', 'Electronics', 56),
    deal('A000000006', 'Home & Kitchen', 55),
  ];
  const result = selectDealsForIngestion(ranked, 2, ['A000000001', 'A000000003', 'A000000006']);
  const asins = new Set(result.map((item) => item.asin));
  assert.equal(asins.has('A000000001'), true);
  assert.equal(asins.has('A000000003'), true);
  assert.equal(asins.has('A000000006'), true);
  assert.equal(result.length, 5, 'existing refreshes do not consume the new-deal cap');
});

test('provider router supplies the current catalog ASINs to the single Rainforest deals pull', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/providerRouter.js'), 'utf8');
  assert.match(source, /const existing = await deals\.listAll\(\)/);
  assert.match(source, /refreshExistingAsins = existing\.map/);
  assert.match(source, /fetchStrictRainforestDeals\(\{ \.\.\.options, refreshExistingAsins \}\)/);
});
