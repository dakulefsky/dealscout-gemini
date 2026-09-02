const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');
const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 80, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };

test('Amazon badge absence does not create manual work', () => {
  assert.equal(scoreVerifiedDeal({ ...base, dealBadge: null }).decision, 'AUTO_APPROVE');
});
