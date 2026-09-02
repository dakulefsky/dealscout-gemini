const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');
const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, sourceVerified: true, availability: 'In Stock' };

test('human queue receives suspicious or incomplete deals', () => {
  assert.equal(scoreVerifiedDeal({ ...base, salePrice: 10, imageUrl: 'x' }).decision, 'PENDING_REVIEW');
  assert.equal(scoreVerifiedDeal({ ...base, salePrice: 70, imageUrl: '' }).decision, 'PENDING_REVIEW');
});
