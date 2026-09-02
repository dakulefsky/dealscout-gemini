const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('soft presentation or anomaly concerns reach human review', () => {
  const common = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 70, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };
  assert.equal(scoreVerifiedDeal({ ...common, imageUrl: '' }).decision, 'PENDING_REVIEW');
  assert.equal(scoreVerifiedDeal({ ...common, salePrice: 10 }).decision, 'PENDING_REVIEW');
});
