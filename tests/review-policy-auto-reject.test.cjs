const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');
const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 70, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };

test('obvious junk is rejected without owner involvement', () => {
  assert.equal(scoreVerifiedDeal({ ...base, sourceVerified: false }).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal({ ...base, availability: 'Unavailable' }).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal({ ...base, salePrice: 95 }).decision, 'REJECT');
});
