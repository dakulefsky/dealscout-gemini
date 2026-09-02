const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('quality score stays bounded for extreme deal', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 1000, salePrice: 1, imageUrl: 'x', sourceVerified: true, availability: 'In Stock', isPrime: true, dealBadge: 'Deal' });
  assert.ok(result.score <= 100);
});
