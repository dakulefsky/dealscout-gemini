const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 80, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };

test('quality engine exposes auto-publish, review, and reject lanes', () => {
  assert.equal(scoreVerifiedDeal(base).decision, 'AUTO_APPROVE');
  assert.equal(scoreVerifiedDeal({ ...base, salePrice: 10 }).decision, 'PENDING_REVIEW');
  assert.equal(scoreVerifiedDeal({ ...base, salePrice: 90 }).decision, 'REJECT');
});
