const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('missing ratings do not send clean deal to owner', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 80, imageUrl: 'x', sourceVerified: true, availability: 'In Stock', rating: null, ratingsTotal: 0 });
  assert.equal(result.decision, 'AUTO_APPROVE');
});
