const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('automatic deal records product image reason', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 80, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.ok(result.reasons.includes('product image'));
});
