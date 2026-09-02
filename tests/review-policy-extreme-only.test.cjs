const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('extreme anomaly threshold starts at 80 percent', () => {
  const common = { asin: 'B012345678', title: 'Product', originalPrice: 100, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };
  assert.equal(scoreVerifiedDeal({ ...common, salePrice: 21 }).decision, 'AUTO_APPROVE');
  assert.equal(scoreVerifiedDeal({ ...common, salePrice: 20 }).decision, 'PENDING_REVIEW');
});
