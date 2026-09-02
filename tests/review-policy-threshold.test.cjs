const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');
const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, imageUrl: 'https://example.com/x.jpg', sourceVerified: true, availability: 'In Stock' };

test('14 percent is rejected while 15 percent enters automatic lane', () => {
  assert.equal(scoreVerifiedDeal({ ...base, salePrice: 86 }).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal({ ...base, salePrice: 85 }).decision, 'AUTO_APPROVE');
});
