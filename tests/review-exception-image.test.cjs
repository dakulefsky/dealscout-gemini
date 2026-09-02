const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('verified deal missing presentation image waits for review', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 75, imageUrl: '', sourceVerified: true, availability: 'In Stock' });
  assert.equal(result.decision, 'PENDING_REVIEW');
  assert.ok(result.reasons.includes('missing image requires review'));
});
