const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('invalid price rejection explains itself', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 100, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.ok(result.reasons.includes('invalid price pair'));
});
