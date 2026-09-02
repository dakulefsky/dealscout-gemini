const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('routine deal is decided automatically', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Routine deal', originalPrice: 100, salePrice: 82, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' });
  assert.notEqual(result.decision, 'PENDING_REVIEW');
});
