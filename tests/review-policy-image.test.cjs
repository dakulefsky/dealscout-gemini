const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('missing image is reviewable rather than silently public', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 70, sourceVerified: true, availability: 'In Stock' });
  assert.equal(result.decision, 'PENDING_REVIEW');
});
