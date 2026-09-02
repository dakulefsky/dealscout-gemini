const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('invalid price pairs are auto-rejected rather than reviewed', () => {
  const base = { asin: 'B012345678', title: 'Product', imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };
  assert.equal(scoreVerifiedDeal({ ...base, originalPrice: 0, salePrice: 10 }).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal({ ...base, originalPrice: 10, salePrice: 10 }).decision, 'REJECT');
});
