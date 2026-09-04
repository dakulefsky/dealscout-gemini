const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('sub-12 percent deal is rejected before human review', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 90, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.equal(result.decision, 'REJECT');
});

test('12 to 15 percent verified deal can enter review but cannot auto-publish', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 87, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.equal(result.decision, 'PENDING_REVIEW');
  assert.match(result.reasons.join(' '), /modest discount requires review/);
});
