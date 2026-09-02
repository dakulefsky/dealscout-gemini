const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('clean deal can auto-publish even when legacy score is below 75', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 84, imageUrl: 'x', sourceVerified: true, availability: 'In Stock', isPrime: false });
  assert.ok(result.score < 75);
  assert.equal(result.decision, 'AUTO_APPROVE');
});
