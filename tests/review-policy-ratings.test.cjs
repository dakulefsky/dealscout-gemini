const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');
const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 80, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };

test('ratings do not create or clear human review work', () => {
  assert.equal(scoreVerifiedDeal({ ...base, rating: 1, ratingsTotal: 1 }).decision, scoreVerifiedDeal({ ...base, rating: 5, ratingsTotal: 999999 }).decision);
});
