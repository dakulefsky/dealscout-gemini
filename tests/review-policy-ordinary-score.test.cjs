const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('ordinary clean deal below old score threshold still auto-publishes', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 84, imageUrl: 'x', sourceVerified: true, availability: 'In Stock', isPrime: false, dealBadge: null });
  assert.ok(result.score < 75);
  assert.equal(result.decision, 'AUTO_APPROVE');
});
