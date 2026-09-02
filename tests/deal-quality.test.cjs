const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreVerifiedDeal } = require('../server/services/dealQualityService');

function base(overrides = {}) {
  return {
    asin: 'B0GGGQDY9H',
    title: 'TCL 60 XE NXTPAPER 5G',
    originalPrice: 249.99,
    salePrice: 179.99,
    rating: 4.1,
    ratingsTotal: 151,
    imageUrl: 'https://example.com/image.jpg',
    sourceVerified: true,
    isPrime: true,
    dealBadge: 'Limited time deal',
    availability: 'In Stock',
    ...overrides,
  };
}

test('strong verified deal is auto-approved from provider-neutral facts', () => {
  const result = scoreVerifiedDeal(base({ originalPrice: 300, salePrice: 175 }));
  assert.equal(result.decision, 'AUTO_APPROVE');
});

test('ordinary verified 15%+ deal auto-publishes instead of filling review queue', () => {
  const result = scoreVerifiedDeal(base({ originalPrice: 100, salePrice: 84, isPrime: false, dealBadge: null }));
  assert.ok(result.score < 75);
  assert.equal(result.decision, 'AUTO_APPROVE');
});

test('extreme discounts are never auto-approved from price math alone', () => {
  const result = scoreVerifiedDeal(base({ originalPrice: 1000, salePrice: 99 }));
  assert.equal(result.decision, 'PENDING_REVIEW');
  assert.equal(result.reasons.includes('extreme discount requires review'), true);
});

test('missing image requires review instead of silent publication', () => {
  const result = scoreVerifiedDeal(base({ imageUrl: '' }));
  assert.equal(result.decision, 'PENDING_REVIEW');
  assert.equal(result.reasons.includes('missing image requires review'), true);
});

test('ratings metadata cannot change publication quality', () => {
  const withoutRatings = scoreVerifiedDeal(base({ rating: null, ratingsTotal: 0 }));
  const withRatings = scoreVerifiedDeal(base({ rating: 4.9, ratingsTotal: 100000 }));
  assert.equal(withRatings.score, withoutRatings.score);
  assert.equal(withRatings.decision, withoutRatings.decision);
  assert.equal(withRatings.reasons.some((reason) => /rating|review/i.test(reason)), false);
});

test('unverified or invalid pricing is rejected', () => {
  assert.equal(scoreVerifiedDeal(base({ sourceVerified: false })).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal(base({ originalPrice: 100, salePrice: 100 })).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal(base({ originalPrice: 100, salePrice: 90 })).decision, 'REJECT');
});

test('out of stock deals are rejected', () => {
  assert.equal(scoreVerifiedDeal(base({ availability: 'Currently unavailable' })).decision, 'REJECT');
});
