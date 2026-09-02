const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('clean 15 percent verified deal meets automatic standard', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 85, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.equal(result.decision, 'AUTO_APPROVE');
});
