const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('a representative ordinary deal does not become manual work', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Everyday Amazon deal', originalPrice: 40, salePrice: 33.99, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.equal(result.decision, 'AUTO_APPROVE');
});
