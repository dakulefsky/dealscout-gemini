const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('quality score remains available even though ordinary publication is exception-based', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 84, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.equal(typeof result.score, 'number');
  assert.equal(result.decision, 'AUTO_APPROVE');
});
