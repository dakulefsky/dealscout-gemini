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

test('strong verified Rainforest deal is auto-approved', () => {
  const result = scoreVerifiedDeal(base());
  assert.equal(result.decision, 'AUTO_APPROVE');
  assert.ok(result.score >= 75);
});

test('verified but modest deal stays pending review', () => {
  const result = scoreVerifiedDeal(base({ originalPrice: 100, salePrice: 84, rating: 3.8, ratingsTotal: 25, isPrime: false, dealBadge: null }));
  assert.equal(result.decision, 'PENDING_REVIEW');
});

test('unverified or invalid pricing is rejected', () => {
  assert.equal(scoreVerifiedDeal(base({ sourceVerified: false })).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal(base({ originalPrice: 100, salePrice: 100 })).decision, 'REJECT');
  assert.equal(scoreVerifiedDeal(base({ originalPrice: 100, salePrice: 90 })).decision, 'REJECT');
});

test('out of stock deals are rejected', () => {
  assert.equal(scoreVerifiedDeal(base({ availability: 'Currently unavailable' })).decision, 'REJECT');
});
