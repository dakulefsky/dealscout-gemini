const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('unverified rejection explains itself', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 70, imageUrl: 'x', sourceVerified: false, availability: 'In Stock' });
  assert.ok(result.reasons.includes('unverified source'));
});
