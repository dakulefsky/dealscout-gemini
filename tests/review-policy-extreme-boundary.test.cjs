const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');
const base = { asin: 'B012345678', title: 'Product', originalPrice: 100, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' };

test('79 percent can auto-publish but 80 percent requires review', () => {
  assert.equal(scoreVerifiedDeal({ ...base, salePrice: 21 }).decision, 'AUTO_APPROVE');
  assert.equal(scoreVerifiedDeal({ ...base, salePrice: 20 }).decision, 'PENDING_REVIEW');
});
