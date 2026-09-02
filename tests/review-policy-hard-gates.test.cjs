const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('hard data failures never reach owner queue', () => {
  const common = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 70, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };
  assert.equal(scoreVerifiedDeal({ ...common, sourceVerified: false }).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal({ ...common, originalPrice: 0 }).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal({ ...common, availability: 'Unavailable' }).decision, 'REJECT');
});
