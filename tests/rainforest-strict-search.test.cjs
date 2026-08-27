const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSearchResult } = require('../server/services/rainforestStrictSearch');

test('strict search keeps only provider-supplied price facts', () => {
  const result = normalizeSearchResult({
    asin: 'B0GGGQDY9H',
    title: 'TCL 60 XE NXTPAPER 5G',
    price: { value: 179.99 },
    rrp: { value: 249.99 },
    rating: 4.1,
    ratings_total: 151,
  });
  assert.equal(result.salePrice, 179.99);
  assert.equal(result.originalPrice, 249.99);
  assert.equal(result.discountPercent, 28);
  assert.equal(result.hasVerifiedDealPricePair, true);
});

test('strict search never estimates a missing original price', () => {
  const result = normalizeSearchResult({
    asin: 'B0GGGQDY9H',
    title: 'TCL 60 XE NXTPAPER 5G',
    price: { value: 179.99 },
  });
  assert.equal(result.salePrice, 179.99);
  assert.equal(result.originalPrice, null);
  assert.equal(result.discountPercent, null);
  assert.equal(result.hasVerifiedDealPricePair, false);
});

test('strict search rejects malformed product rows', () => {
  assert.equal(normalizeSearchResult({ asin: 'bad', title: 'Nope' }), null);
  assert.equal(normalizeSearchResult({ asin: 'B0GGGQDY9H' }), null);
});
