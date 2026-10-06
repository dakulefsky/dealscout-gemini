const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('sub-15 percent deals are rejected before human review', () => {
  const ten = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 90, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' }, Date.parse('2026-10-01T12:00:00Z'));
  const thirteen = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 87, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' }, Date.parse('2026-10-01T12:00:00Z'));
  assert.equal(ten.decision, 'REJECT');
  assert.equal(thirteen.decision, 'REJECT');
  assert.match(thirteen.reasons.join(' '), /discount below 15%/);
});

test('15 percent verified deal can auto-publish when otherwise valid', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 85, imageUrl: 'x', sourceVerified: true, availability: 'In Stock' }, Date.parse('2026-10-01T12:00:00Z'));
  assert.equal(result.decision, 'AUTO_APPROVE');
});
