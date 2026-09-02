const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('manual lane is reserved for ambiguous presentation or price anomalies', () => {
  const common = { asin: 'B012345678', title: 'Product', originalPrice: 100, sourceVerified: true, availability: 'In Stock' };
  assert.equal(scoreVerifiedDeal({ ...common, salePrice: 75, imageUrl: '' }).decision, 'PENDING_REVIEW');
  assert.equal(scoreVerifiedDeal({ ...common, salePrice: 10, imageUrl: 'x' }).decision, 'PENDING_REVIEW');
});
