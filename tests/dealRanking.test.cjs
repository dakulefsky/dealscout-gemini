const test = require('node:test');
const assert = require('node:assert/strict');

async function loadRanking() {
  return import('../src/lib/dealRanking.js');
}

test('stronger verified deal outranks a weak fresh deal', async () => {
  const { dealRankScore } = await loadRanking();
  const now = Date.UTC(2026, 7, 27, 20, 0, 0);
  const strong = { discountPercent: 45, salePrice: 80, originalPrice: 150, sourceVerified: true, imageUrl: 'https://example.com/a.jpg', priceCheckAt: now / 1000 - 3600 };
  const weak = { discountPercent: 12, salePrice: 175, originalPrice: 199, sourceVerified: true, imageUrl: 'https://example.com/b.jpg', priceCheckAt: now / 1000 - 300 };
  assert.ok(dealRankScore(strong, now) > dealRankScore(weak, now));
});

test('missing image and stale verification reduce ranking', async () => {
  const { dealRankScore } = await loadRanking();
  const now = Date.UTC(2026, 7, 27, 20, 0, 0);
  const fresh = { discountPercent: 30, salePrice: 100, originalPrice: 150, sourceVerified: true, imageUrl: 'https://example.com/a.jpg', priceCheckAt: now / 1000 - 3600 };
  const stale = { ...fresh, imageUrl: '', priceCheckAt: now / 1000 - (5 * 24 * 3600) };
  assert.ok(dealRankScore(fresh, now) > dealRankScore(stale, now));
});
