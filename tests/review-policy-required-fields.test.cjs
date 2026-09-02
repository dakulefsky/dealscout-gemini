const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('missing ASIN or title is rejected automatically', () => {
  const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 70, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };
  assert.equal(scoreVerifiedDeal({ ...base, asin: '' }).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal({ ...base, title: '' }).decision, 'REJECT');
});
