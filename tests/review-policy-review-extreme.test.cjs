const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('extreme price math is an exception instead of blind auto-publish', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 1000, salePrice: 100, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.equal(result.decision, 'PENDING_REVIEW');
});
