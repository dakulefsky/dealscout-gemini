const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');
const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 80, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };

test('Prime status does not force human review', () => {
  assert.equal(scoreVerifiedDeal({ ...base, isPrime: false }).decision, 'AUTO_APPROVE');
  assert.equal(scoreVerifiedDeal({ ...base, isPrime: true }).decision, 'AUTO_APPROVE');
});
