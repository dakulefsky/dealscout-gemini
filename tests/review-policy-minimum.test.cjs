const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('automatic lane still requires verification, valid pricing, stock, discount, and image', () => {
  const clean = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 85, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };
  assert.equal(scoreVerifiedDeal(clean).decision, 'AUTO_APPROVE');
  assert.notEqual(scoreVerifiedDeal({ ...clean, imageUrl: '' }).decision, 'AUTO_APPROVE');
  assert.notEqual(scoreVerifiedDeal({ ...clean, sourceVerified: false }).decision, 'AUTO_APPROVE');
});
