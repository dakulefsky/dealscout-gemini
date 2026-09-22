const test = require('node:test');
const assert = require('node:assert/strict');

test('homepage hero requires a fresh verified discount supported by actual prices', async () => {
  const { selectHeroDeal, trustworthyDiscountPercent } = await import('../src/lib/heroDealQuality.js');
  const now = 1_800_000_000_000;
  const freshSeconds = Math.floor(now / 1000) - 60;

  const good = { id: 'good', sourceVerified: true, priceCheckAt: freshSeconds, originalPrice: 100, salePrice: 60, discountPercent: 40 };
  const exaggerated = { id: 'fake', sourceVerified: true, priceCheckAt: freshSeconds, originalPrice: 100, salePrice: 80, discountPercent: 80 };
  const stale = { id: 'stale', sourceVerified: true, priceCheckAt: freshSeconds - 13 * 3600, originalPrice: 100, salePrice: 50, discountPercent: 50 };
  const unverified = { id: 'unverified', sourceVerified: false, priceCheckAt: freshSeconds, originalPrice: 100, salePrice: 40, discountPercent: 60 };

  assert.equal(Math.round(trustworthyDiscountPercent(good, now)), 40);
  assert.equal(Math.round(trustworthyDiscountPercent(exaggerated, now)), 20);
  assert.equal(trustworthyDiscountPercent(stale, now), 0);
  assert.equal(trustworthyDiscountPercent(unverified, now), 0);
  assert.equal(selectHeroDeal([exaggerated, stale, unverified, good], now)?.id, 'good');
  assert.equal(selectHeroDeal([exaggerated, stale, unverified], now), null);
});
