const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('presentation failure is reviewed while source failure is rejected', () => {
  const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 70, availability: 'In Stock' };
  assert.equal(scoreVerifiedDeal({ ...base, sourceVerified: true, imageUrl: '' }).decision, 'PENDING_REVIEW');
  assert.equal(scoreVerifiedDeal({ ...base, sourceVerified: false, imageUrl: 'x' }).decision, 'REJECT');
});
