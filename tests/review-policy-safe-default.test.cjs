const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('automation is permissive only after hard safety-quality gates pass', () => {
  const clean = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 80, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };
  assert.equal(scoreVerifiedDeal(clean).decision, 'AUTO_APPROVE');
  assert.equal(scoreVerifiedDeal({ ...clean, availability: 'Unavailable' }).decision, 'REJECT');
});
