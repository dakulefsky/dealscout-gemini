const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

function base(overrides = {}) {
  return {
    asin: 'B0GGGQDY9H', title: 'TCL 60 XE NXTPAPER 5G', originalPrice: 249.99, salePrice: 179.99,
    rating: 4.1, ratingsTotal: 151, imageUrl: 'https://example.com/image.jpg', sourceVerified: true,
    isPrime: true, dealBadge: 'Limited time deal', availability: 'In Stock', ...overrides,
  };
}

test('strong verified deal is auto-approved', () => {
  assert.equal(scoreVerifiedDeal(base({ originalPrice: 300, salePrice: 175 })).decision, 'AUTO_APPROVE');
});

test('ordinary verified 15%+ deal auto-publishes instead of filling review queue', () => {
  const result = scoreVerifiedDeal(base({ originalPrice: 100, salePrice: 84, isPrime: false, dealBadge: null }));
  assert.equal(result.decision, 'AUTO_APPROVE');
});

test('extreme discounts require human review', () => {
  const result = scoreVerifiedDeal(base({ originalPrice: 1000, salePrice: 99 }));
  assert.equal(result.decision, 'PENDING_REVIEW');
  assert.equal(result.reasons.includes('extreme discount requires review'), true);
});

test('missing image requires human review rather than automatic publication', () => {
  assert.equal(scoreVerifiedDeal(base({ imageUrl: '' })).decision, 'PENDING_REVIEW');
});

test('ratings metadata cannot change publication quality', () => {
  const withoutRatings = scoreVerifiedDeal(base({ rating: null, ratingsTotal: 0 }));
  const withRatings = scoreVerifiedDeal(base({ rating: 4.9, ratingsTotal: 100000 }));
  assert.equal(withRatings.score, withoutRatings.score);
  assert.equal(withRatings.decision, withoutRatings.decision);
});

test('unverified or invalid pricing is rejected', () => {
  assert.equal(scoreVerifiedDeal(base({ sourceVerified: false })).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal(base({ originalPrice: 100, salePrice: 100 })).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal(base({ originalPrice: 100, salePrice: 90 })).decision, 'REJECT');
});

test('out of stock deals are rejected', () => {
  assert.equal(scoreVerifiedDeal(base({ availability: 'Currently unavailable' })).decision, 'REJECT');
});
