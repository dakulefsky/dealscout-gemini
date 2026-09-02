const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('substandard discount is rejected without review', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 90, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.equal(result.decision, 'REJECT');
});
