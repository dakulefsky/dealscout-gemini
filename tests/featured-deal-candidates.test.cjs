const test = require('node:test');
const assert = require('node:assert/strict');

test('featured deals keep valid older source-verified offers visible but flag the price check', async () => {
  const { featuredDealCandidates } = await import('../src/lib/heroDealQuality.js');
  const now = 1_800_000_000_000;
  const candidates = featuredDealCandidates([
    { id: 'old-verified', sourceVerified: true, priceCheckAt: 1, originalPrice: 100, salePrice: 60, discountPercent: 40 },
    { id: 'unverified', sourceVerified: false, originalPrice: 100, salePrice: 40, discountPercent: 60 },
    { id: 'expired', sourceVerified: true, status: 'EXPIRED', originalPrice: 100, salePrice: 30, discountPercent: 70 },
    { id: 'invalid', sourceVerified: true, originalPrice: 100, salePrice: 120, discountPercent: 30 },
  ], now);

  assert.deepEqual(candidates.map(({ deal, needsPriceCheck }) => [deal.id, needsPriceCheck]), [['old-verified', true]]);
  assert.equal(candidates[0].discount, 40);
});

test('fresh, verified deals remain eligible for the featured section', async () => {
  const { featuredDealCandidates } = await import('../src/lib/heroDealQuality.js');
  const now = 1_800_000_000_000;
  const candidates = featuredDealCandidates([
    { id: 'fresh', sourceVerified: true, priceCheckAt: now / 1000, originalPrice: 100, salePrice: 70, discountPercent: 35 },
    { id: 'old', sourceVerified: true, priceCheckAt: 1, originalPrice: 100, salePrice: 20, discountPercent: 80 },
  ], now);

  assert.deepEqual(candidates.map(({ deal, needsPriceCheck }) => [deal.id, needsPriceCheck]), [['fresh', false]]);
});
