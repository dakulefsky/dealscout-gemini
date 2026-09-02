const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

test('clean deal with image avoids manual queue', () => {
  const result = scoreVerifiedDeal({ asin: 'B012345678', title: 'Product', originalPrice: 100, salePrice: 80, imageUrl: 'https://example.com/image.jpg', sourceVerified: true, availability: 'In Stock' });
  assert.equal(result.decision, 'AUTO_APPROVE');
});
