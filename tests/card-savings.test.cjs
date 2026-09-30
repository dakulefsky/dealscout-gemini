const test = require('node:test');
const assert = require('node:assert/strict');

test('card savings derive from actual prices even if the supplied percentage is missing or exaggerated', async () => {
  const { dealSavings } = await import('../src/lib/dealSavings.js');
  assert.deepEqual(dealSavings({ originalPrice: 100, salePrice: 64, discountPercent: 80 }), { amount: 36, percent: 36 });
  assert.deepEqual(dealSavings({ original_price: '49.99', sale_price: '29.99' }), { amount: 20, percent: 40 });
  assert.equal(dealSavings({ originalPrice: 30, salePrice: 20 }).percent, 33);
  for (const deal of [null, {}, { originalPrice: 100, salePrice: null }, { originalPrice: 10, salePrice: 20 }, { originalPrice: Infinity, salePrice: 3 }, { originalPrice: 100, salePrice: 60, isExpired: true }]) {
    assert.deepEqual(dealSavings(deal), { amount: 0, percent: 0 });
  }
});
